"use server"

import { revalidatePath } from "next/cache"
import { pool } from "@/lib/db"
import { BOOKING_VALIDITY_MONTHS, computeBookingValidity, maxRideAlongLaps, rescheduleFeeFor } from "@/lib/turboride/fleet"
import { getCarById } from "@/lib/turboride/cars"
import { getDiscountRates, getGstRate, getReelPrice, getSettings } from "@/lib/turboride/settings"
import { assertSlotAvailable } from "@/lib/turboride/schedule"
import { calculatePrice, discountedFullPayTotal, type CarLine, type PaymentOption } from "@/lib/turboride/pricing"
import { bookingMatchClause } from "@/lib/turboride/identifier"
import { getSessionIdentifier } from "./auth"
import { getPaymentRuntime, initiateGatewayPayment } from "@/lib/turboride/payments"
import { sendBookingConfirmation } from "@/lib/turboride/email/booking-emails"

/** A single car in the booking lineup as submitted from the client. */
export type CreateBookingCar = { carId: string; laps: number; rideAlongLaps?: number }

export type CreateBookingInput = {
  /** The lineup of cars, driven back-to-back in one slot. Must contain at least one. */
  cars: CreateBookingCar[]
  reels: number
  date?: string | null
  slot?: string | null
  payment: PaymentOption
  contact: { name: string; email: string; phone: string }
}

/** Persisted shape of one car line in the `cars` JSONB column. */
export type BookingCarLine = {
  carId: string
  carName: string
  laps: number
  rideAlongLaps: number
  pricePerLap: number
}

export type CreateBookingSuccess = {
  ok: true
  reference: string
  total: number
  payNow: number
  /**
   * When true, payment was settled instantly in simulation mode — the caller shows the
   * inline confirmation as before. When false, the customer must be redirected to the
   * gateway using `redirectUrl` to complete a real payment.
   */
  simulated: boolean
  /** Hosted gateway URL to send the browser to (only present when simulated === false). */
  redirectUrl?: string
}

/**
 * Booking failures are RETURNED, not thrown. Next.js redacts thrown Server Action
 * error messages in production, so throwing would leave the customer with a
 * meaningless generic toast instead of the real reason (slot sold out, etc.).
 */
export type CreateBookingResult = CreateBookingSuccess | { ok: false; error: string }

function makeRef() {
  return "TRB-" + Math.random().toString(36).slice(2, 8).toUpperCase()
}

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  // Global kill switch — admins can pause all new bookings from Settings.
  const settings = await getSettings()
  if (settings.bookingsPaused) {
    return { ok: false, error: "Bookings are temporarily paused. Please check back soon." }
  }

  // Server-side validation: never trust client-supplied cars, laps, or prices. Re-fetch
  // every car, reject anything not currently available, and clamp laps + ride-along.
  const inputCars = Array.isArray(input.cars) ? input.cars : []
  if (inputCars.length === 0) {
    return { ok: false, error: "Please add at least one car to your session." }
  }
  const lines: CarLine[] = []
  for (const c of inputCars) {
    const car = await getCarById(c.carId)
    if (!car) return { ok: false, error: "One of the selected cars is no longer available." }
    if (car.status !== "available") {
      return { ok: false, error: `${car.name} isn't available to book yet.` }
    }
    // Laps must be one of the admin-configured options — never trust an arbitrary client value.
    const laps = Math.floor(c.laps || 0)
    if (!settings.lapOptions.includes(laps)) {
      return { ok: false, error: `Please choose a valid lap option for ${car.name}.` }
    }
    // Co-passenger can only ride on laps after the mandatory instructor lap (laps - 1).
    const rideAlongLaps = Math.max(0, Math.min(maxRideAlongLaps(laps), Math.floor(c.rideAlongLaps || 0)))
    lines.push({ car, laps, rideAlongLaps })
  }

  const reels = Math.max(0, Math.min(10, Math.floor(input.reels || 0)))
  const name = input.contact.name.trim()
  if (name.length < 2) return { ok: false, error: "Please enter your full name." }
  if (!emailValid(input.contact.email)) return { ok: false, error: "Please enter a valid email address." }
  if (input.contact.phone.replace(/\D/g, "").length < 10) {
    return { ok: false, error: "Please enter a valid 10-digit mobile number." }
  }

  // Two ways to pay: in full online (discount) or at the venue on drive day.
  const payment: PaymentOption = input.payment === "venue" ? "venue" : "full"
  const discountRates = await getDiscountRates()
  const reelPrice = await getReelPrice()
  const gstRate = await getGstRate()
  const price = calculatePrice({ cars: lines, reels, payment }, discountRates, reelPrice, gstRate)

  // Legacy single-car columns are kept in sync for backward compatibility: the first
  // car anchors car_id/car_name, `laps` holds the combined lap count, and the full
  // lineup lives in the new `cars` JSONB column.
  const firstCar = lines[0].car
  const totalLaps = lines.reduce((sum, l) => sum + l.laps, 0)
  const totalRideAlongLaps = lines.reduce((sum, l) => sum + l.rideAlongLaps, 0)
  const carsJson: BookingCarLine[] = lines.map((l) => ({
    carId: l.car.id,
    carName: l.car.name,
    laps: l.laps,
    rideAlongLaps: l.rideAlongLaps,
    pricePerLap: l.car.pricePerLap,
  }))

  // Every booking must land on an open date/slot with remaining capacity.
  if (!input.date || !input.slot) {
    return { ok: false, error: "Please choose a date and time slot." }
  }
  try {
    await assertSlotAvailable(input.date, input.slot)
  } catch (e) {
    // Availability guards throw customer-facing messages; surface them verbatim.
    console.error("[v0] Slot availability check failed:", e)
    const msg = e instanceof Error ? e.message : "That date or time slot is unavailable."
    return { ok: false, error: msg }
  }

  const reference = makeRef()

  // Decide up front whether we settle instantly (simulation/preview or missing keys)
  // or must send the customer to a real hosted gateway to pay `price.payNow`.
  const runtime = await getPaymentRuntime()

  // Booking lifecycle:
  //  - simulation → record the amount as paid immediately (behaves like the old demo flow).
  //  - real gateway → create the booking as `pending` with amount_paid = 0; the callback /
  //    webhook flips it to scheduled/confirmed once the gateway confirms the capture.
  const initialStatus = runtime.simulate ? (payment === "venue" ? "scheduled" : "confirmed") : "pending"
  const initialPaid = runtime.simulate ? price.payNow : 0
  const initialPaidInFull = runtime.simulate && price.payNow >= price.total ? new Date() : null

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(
      `INSERT INTO bookings
        (id, car_id, car_name, laps, addons, cars, experience_date, time_slot,
         customer_name, customer_email, customer_phone,
         base_price, addons_price, discount, tax, total, amount_paid,
         is_prebook, status, paid_in_full_at, payment_gateway)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        reference,
        firstCar.id,
        firstCar.name,
        totalLaps,
        JSON.stringify({ reels, rideAlongLaps: totalRideAlongLaps }),
        JSON.stringify(carsJson),
        input.date,
        input.slot,
        name,
        input.contact.email.trim().toLowerCase(),
        input.contact.phone.trim(),
        price.base,
        price.addons,
        price.discount,
        price.gst,
        price.total,
        initialPaid,
        false,
        initialStatus,
        initialPaidInFull,
        runtime.simulate ? null : runtime.gateway,
      ],
    )

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[v0] createBooking transaction failed:", err)
    return { ok: false, error: "We couldn't confirm your booking. No payment was taken — please try again." }
  } finally {
    client.release()
  }

  // Simulation/preview: settle instantly, exactly like the original demo flow.
  if (runtime.simulate) {
    await sendBookingConfirmation(reference)
    return { ok: true, reference, total: price.total, payNow: price.payNow, simulated: true }
  }

  // Real gateway: kick off a hosted payment for the amount due now and hand back a
  // redirect URL. If initiation fails, void the pending booking so the slot isn't held.
  try {
    const init = await initiateGatewayPayment({
      reference,
      amountPaise: Math.round(price.payNow * 100),
      contact: { name, email: input.contact.email.trim().toLowerCase(), phone: input.contact.phone.trim() },
      description: `TurboRide booking ${reference}`,
    })
    if (!init.ok) {
      // The gateway never opened, so no payment could ever happen for this reference.
      // Delete the placeholder row entirely — an unopened checkout must not leave a booking.
      await pool.query(`DELETE FROM bookings WHERE id = $1 AND status = 'pending'`, [reference])
      // Surface the gateway's real reason (e.g. bad credentials, wrong mode) instead of a
      // generic message, so a misconfigured integration is debuggable from the checkout.
      console.error(`[v0] ${init.gateway} initiation rejected:`, init.error)
      const reason = init.error ? ` (${init.error})` : ""
      return { ok: false, error: `We couldn't start the payment${reason}. Please check your payment gateway settings and try again.` }
    }
    // Save the gateway's order id so the callback/webhook can verify this exact payment.
    await pool.query(`UPDATE bookings SET payment_id = $2 WHERE id = $1`, [reference, init.orderId])
    return {
      ok: true,
      reference,
      total: price.total,
      payNow: price.payNow,
      simulated: false,
      redirectUrl: init.redirectUrl,
    }
  } catch (err) {
    console.error("[v0] Payment initiation failed:", err)
    // Initiation crashed before the gateway opened — remove the placeholder booking.
    await pool.query(`DELETE FROM bookings WHERE id = $1 AND status = 'pending'`, [reference]).catch(() => {})
    return { ok: false, error: "We couldn't start the payment. Please try again." }
  }
}

/**
 * Settle a booking after a gateway confirms payment (called from the callback + webhook).
 * Idempotent: a booking already marked paid is left untouched, so duplicate webhook +
 * callback hits don't double-apply. Returns the resulting status for the caller to route on.
 */
export async function settleBookingPayment(
  reference: string,
): Promise<{ ok: boolean; status: "confirmed" | "scheduled" | "pending" | "failed"; error?: string }> {
  const res = await pool.query(
    `SELECT status, total, amount_paid, payment_gateway, payment_id FROM bookings WHERE id = $1`,
    [reference],
  )
  const row = res.rows[0]
  if (!row) return { ok: false, status: "failed", error: "Booking not found." }

  // Already settled — nothing to do.
  if (row.status === "confirmed" || row.status === "scheduled") {
    return { ok: true, status: row.status }
  }

  const gateway = (row.payment_gateway as "phonepe" | "razorpay" | null) ?? null
  const gatewayOrderId = (row.payment_id as string | null) ?? null
  if (!gateway || !gatewayOrderId) return { ok: false, status: "pending", error: "Missing gateway reference." }

  const { verifyGatewayPayment } = await import("@/lib/turboride/payments")
  const verify = await verifyGatewayPayment({ gateway, gatewayOrderId })

  if (verify.state !== "paid") {
    if (verify.state === "failed") {
      await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`, [reference])
      return { ok: false, status: "failed", error: "Payment was not completed." }
    }
    return { ok: false, status: "pending", error: "Payment is still pending." }
  }

  // Paid: the amount captured settles the booking. If it covers the full total the drive
  // is confirmed and the validity clock starts; a partial (venue advance) stays scheduled.
  const paid = verify.amountPaise > 0 ? Math.round(verify.amountPaise / 100) : Number(row.amount_paid)
  const total = Number(row.total)
  const status: "confirmed" | "scheduled" = paid >= total ? "confirmed" : "scheduled"

  const upd = await pool.query(
    `UPDATE bookings
     SET amount_paid = $2, status = $3,
         paid_in_full_at = CASE WHEN $2 >= total THEN COALESCE(paid_in_full_at, now()) ELSE paid_in_full_at END
     WHERE id = $1 AND status = 'pending'`,
    [reference, paid, status],
  )
  // Only the call that actually flipped the row (rowCount === 1) sends the email, so a
  // near-simultaneous webhook + callback can't produce a duplicate confirmation.
  if (upd.rowCount === 1) await sendBookingConfirmation(reference)
  revalidatePath("/account")
  revalidatePath("/admin/bookings")
  return { ok: true, status }
}

/* ----------------------------- Account portal ----------------------------- */

export type MyBooking = {
  reference: string
  carId: string
  carName: string
  laps: number
  /** Full multi-car lineup; legacy bookings fall back to a single line from carId/carName/laps. */
  cars: BookingCarLine[]
  reels: number
  /** Laps a co-passenger rode along (from the addons jsonb). */
  rideAlongLaps: number
  date: string | null
  slot: string | null
  status: string
  total: number
  amountPaid: number
  /** Base fare (Σ pricePerLap × laps) — the figure the full-pay discount applies to. */
  basePrice: number
  /** Add-ons total (reels + ride-along) — discount-exempt, but still GST-charged. */
  addonsPrice: number
  /** Full-pay discount actually applied (₹); 0 for advance/pay-at-venue bookings. */
  discount: number
  /** GST actually charged (₹). */
  tax: number
  createdAt: string
  /** ISO timestamp of when the booking was paid in full (starts the validity clock); null until then. */
  paidInFullAt: string | null
  /** How many times this booking has already been rescheduled (first is free). */
  rescheduleCount: number
  /** Total reschedule fees collected on this booking, in ₹. */
  rescheduleFeesPaid: number
}

export type MyAccount = {
  identifier: string
  bookings: MyBooking[]
}

/** Bookings belonging to the signed-in customer (matched by email or last-10 phone digits). */
export async function getMyBookings(): Promise<MyAccount | null> {
  const identifier = await getSessionIdentifier()
  if (!identifier) return null

  const { clause, param } = bookingMatchClause(identifier)
  const res = await pool.query(
    `SELECT id, car_id, car_name, laps, addons, cars, experience_date, time_slot,
            status, total, amount_paid, base_price, addons_price, discount, tax, created_at,
            paid_in_full_at, reschedule_count, reschedule_fees_paid
     FROM bookings
     WHERE ${clause}
       AND status <> 'pending' AND NOT (status = 'cancelled' AND amount_paid = 0)
     ORDER BY created_at DESC`,
    [param],
  )

  const bookings: MyBooking[] = res.rows.map((r) => {
    const rideAlongLaps = Number(r.addons?.rideAlongLaps ?? 0)
    // Prefer the stored lineup; fall back to one line for legacy pre-multi-car bookings.
    const rawCars = r.cars as BookingCarLine[] | null
    const cars: BookingCarLine[] =
      Array.isArray(rawCars) && rawCars.length > 0
        ? rawCars.map((c) => ({
            carId: c.carId,
            carName: c.carName,
            laps: Number(c.laps),
            rideAlongLaps: Number(c.rideAlongLaps ?? 0),
            pricePerLap: Number(c.pricePerLap ?? 0),
          }))
        : [{ carId: r.car_id, carName: r.car_name, laps: Number(r.laps), rideAlongLaps, pricePerLap: 0 }]
    return {
    reference: r.id,
    carId: r.car_id,
    carName: r.car_name,
    laps: r.laps,
    cars,
    reels: Number(r.addons?.reels ?? 0),
    rideAlongLaps,
    date: r.experience_date,
    slot: r.time_slot,
    status: r.status,
    total: r.total,
    amountPaid: r.amount_paid,
    basePrice: Number(r.base_price ?? 0),
    addonsPrice: Number(r.addons_price ?? 0),
    discount: Number(r.discount ?? 0),
    tax: Number(r.tax ?? 0),
    createdAt: new Date(r.created_at).toISOString(),
    paidInFullAt: r.paid_in_full_at ? new Date(r.paid_in_full_at).toISOString() : null,
    rescheduleCount: Number(r.reschedule_count ?? 0),
    rescheduleFeesPaid: Number(r.reschedule_fees_paid ?? 0),
    }
  })

  return { identifier, bookings }
}

export type ContactPrefill = { name: string; email: string; phone: string }

/**
 * Contact details for the signed-in customer, pulled from their most recent booking,
 * so a returning logged-in driver doesn't have to retype name/email/phone at checkout.
 * Returns null when nobody is logged in.
 */
export async function getContactPrefill(): Promise<ContactPrefill | null> {
  try {
    const identifier = await getSessionIdentifier()
    if (!identifier) return null

    const { clause, param } = bookingMatchClause(identifier)
    const res = await pool.query(
      `SELECT customer_name, customer_email, customer_phone
       FROM bookings WHERE ${clause} ORDER BY created_at DESC LIMIT 1`,
      [param],
    )
    const row = res.rows[0]
    if (!row) return null

    return {
      name: (row.customer_name as string) ?? "",
      email: (row.customer_email as string) ?? "",
      phone: (row.customer_phone as string) ?? "",
    }
  } catch (err) {
    console.log("[TurboRide] getContactPrefill failed:", (err as Error).message)
    return null
  }
}

export type RescheduleInput = { reference: string; date: string; slot: string }

export type RescheduleResult =
  | {
      ok: true
      /** Fee taken for this reschedule (₹0 for the first, RESCHEDULE_FEE thereafter). */
      feeCharged: number
      /** Reschedule count after this move. */
      rescheduleCount: number
      /** Validity deadline (ISO), or null when the clock hasn't started. */
      deadline: string | null
    }
  | { ok: false; error: string }

/**
 * Customer self-service reschedule from the members area. Available on any booking
 * with a locked-in drive (fully paid, or scheduling already done). The first
 * reschedule is free; each subsequent one costs RESCHEDULE_FEE. New dates must fall
 * inside the booking's validity window (BOOKING_VALIDITY_MONTHS after full payment);
 * an expired booking is a no-show with no refund and cannot be moved.
 */
export async function rescheduleBooking(input: RescheduleInput): Promise<RescheduleResult> {
  const identifier = await getSessionIdentifier()
  if (!identifier) return { ok: false, error: "Please sign in again." }
  if (!input.date || !input.slot) return { ok: false, error: "Choose a new date and time slot." }

  const { clause, param } = bookingMatchClause(identifier)
  const res = await pool.query(
    `SELECT id, experience_date, time_slot, status,
            paid_in_full_at, reschedule_count
     FROM bookings WHERE id = $2 AND ${clause}`,
    [param, input.reference],
  )
  const row = res.rows[0]
  if (!row) return { ok: false, error: "Booking not found." }

  // Only a locked-in drive can be moved.
  if (!row.experience_date || !row.time_slot || !["scheduled", "confirmed"].includes(row.status)) {
    return { ok: false, error: "This booking isn't scheduled yet, so there's nothing to reschedule." }
  }

  const paidInFullAt = row.paid_in_full_at ? new Date(row.paid_in_full_at).toISOString() : null
  const { deadline, expired } = computeBookingValidity(paidInFullAt)
  if (expired) {
    return {
      ok: false,
      error: `This booking has passed its ${BOOKING_VALIDITY_MONTHS}-month validity and is marked as a no-show — no refund or reschedule is available.`,
    }
  }

  if (row.experience_date === input.date && row.time_slot === input.slot) {
    return { ok: false, error: "Pick a different date or time to reschedule." }
  }

  // Keep the new drive inside the validity window (only enforced once the clock has started).
  if (deadline && new Date(input.date + "T00:00:00").getTime() > new Date(deadline).getTime()) {
    return { ok: false, error: "Please choose a date within your booking's validity window." }
  }

  try {
    await assertSlotAvailable(input.date, input.slot)
  } catch (e) {
    console.error("[v0] Reschedule slot availability check failed:", e)
    const msg = e instanceof Error ? e.message : "That date or time slot is unavailable."
    return { ok: false, error: msg }
  }

  const pastCount = Number(row.reschedule_count ?? 0)
  const fee = rescheduleFeeFor(pastCount)

  await pool.query(
    `UPDATE bookings
     SET experience_date = $2, time_slot = $3,
         reschedule_count = reschedule_count + 1,
         reschedule_fees_paid = reschedule_fees_paid + $4
     WHERE id = $1`,
    [input.reference, input.date, input.slot, fee],
  )

  revalidatePath("/account")
  revalidatePath("/admin/bookings")
  return {
    ok: true,
    feeCharged: fee,
    rescheduleCount: pastCount + 1,
    deadline,
  }
}

export type PayBalanceResult =
  | {
      ok: true
      /** Amount charged online just now to clear the balance (₹). */
      paidOnline: number
      /** How much the customer saved versus settling the undiscounted balance at the venue (₹). */
      saved: number
      /** New all-inclusive total after the full-pay discount was applied (₹). */
      total: number
      /** True when settled instantly in simulation mode; false when a redirect is required. */
      simulated: boolean
      /** Hosted gateway URL to complete a real payment (only when simulated === false). */
      redirectUrl?: string
    }
  | { ok: false; error: string }

/**
 * Customer self-service balance settlement from the members area. A pay-at-venue booking
 * collected only the ₹1,000 advance with no discount; paying the balance online now
 * re-prices the booking with the full-pay discount (applied to the base fare), so the
 * customer pays the discounted remainder instead of the full venue balance. Marks the
 * booking paid in full and starts the validity clock.
 *
 * Payment is simulated here to match checkout (createBooking), which records amount_paid
 * without a live gateway call. Wire a real gateway in front of this when one is added.
 */
export async function payBalance(input: { reference: string }): Promise<PayBalanceResult> {
  const identifier = await getSessionIdentifier()
  if (!identifier) return { ok: false, error: "Please sign in again." }

  const { clause, param } = bookingMatchClause(identifier)
  const res = await pool.query(
    `SELECT id, status, total, amount_paid, base_price, addons_price, paid_in_full_at,
            customer_name, customer_email, customer_phone
     FROM bookings WHERE id = $2 AND ${clause}`,
    [param, input.reference],
  )
  const row = res.rows[0]
  if (!row) return { ok: false, error: "Booking not found." }

  if (!["scheduled", "confirmed"].includes(row.status)) {
    return { ok: false, error: "This booking can't be paid online." }
  }

  // Expired no-shows can't be settled.
  const paidInFullAt = row.paid_in_full_at ? new Date(row.paid_in_full_at).toISOString() : null
  const { expired } = computeBookingValidity(paidInFullAt)
  if (expired) {
    return { ok: false, error: "This booking has passed its validity window and can no longer be paid." }
  }

  const currentTotal = Number(row.total)
  const amountPaid = Number(row.amount_paid)
  const balance = currentTotal - amountPaid
  if (balance <= 0) {
    return { ok: false, error: "This booking is already paid in full." }
  }

  // Re-price with the current full-pay discount so the customer gets the same deal as
  // paying in full online at checkout. Discount applies to the base fare only.
  const base = Number(row.base_price ?? 0)
  const addons = Number(row.addons_price ?? 0)
  const { discount: discountRate } = await getDiscountRates()
  const gstRate = await getGstRate()
  const newTotal = discountedFullPayTotal(base, addons, discountRate, gstRate)
  const discountAmount = Math.round(base * discountRate)
  const gst = newTotal - (base - discountAmount + addons)

  // Guard: the discounted total should still be at least what's already been paid.
  const paidOnline = Math.max(0, newTotal - amountPaid)
  const saved = Math.max(0, currentTotal - newTotal)

  const runtime = await getPaymentRuntime()

  // Simulation/preview: settle instantly, exactly like the original demo flow.
  if (runtime.simulate) {
    await pool.query(
      `UPDATE bookings
       SET total = $2, discount = $3, tax = $4, amount_paid = $2,
           status = 'confirmed',
           paid_in_full_at = COALESCE(paid_in_full_at, now())
       WHERE id = $1`,
      [input.reference, newTotal, discountAmount, gst],
    )
    revalidatePath("/account")
    revalidatePath("/admin/bookings")
    return { ok: true, paidOnline, saved, total: newTotal, simulated: true }
  }

  // Real gateway: apply the re-priced total/discount/tax now (so the confirmation page
  // and admin reflect the deal), but leave amount_paid/status until the gateway confirms.
  // The callback/webhook's settleBookingPayment will bump amount_paid and mark confirmed.
  await pool.query(
    `UPDATE bookings SET total = $2, discount = $3, tax = $4, payment_gateway = $5 WHERE id = $1`,
    [input.reference, newTotal, discountAmount, gst, runtime.gateway],
  )
  try {
    const init = await initiateGatewayPayment({
      reference: input.reference,
      amountPaise: Math.round(paidOnline * 100),
      contact: {
        name: (row.customer_name as string) ?? "",
        email: (row.customer_email as string) ?? "",
        phone: (row.customer_phone as string) ?? "",
      },
      description: `TurboRide balance ${input.reference}`,
    })
    if (!init.ok) return { ok: false, error: "We couldn't start the payment. Please try again." }
    await pool.query(`UPDATE bookings SET payment_id = $2 WHERE id = $1`, [input.reference, init.orderId])
    return { ok: true, paidOnline, saved, total: newTotal, simulated: false, redirectUrl: init.redirectUrl }
  } catch (err) {
    console.error("[v0] payBalance initiation failed:", err)
    return { ok: false, error: "We couldn't start the payment. Please try again." }
  }
}
