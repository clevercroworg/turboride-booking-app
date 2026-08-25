import "server-only"
import { pool } from "@/lib/db"
import { BOOKING_VALIDITY_MONTHS } from "@/lib/turboride/fleet"

/** One car line within a booking's lineup, as stored in the `cars` JSONB column. */
export type AdminBookingCar = {
  carId: string
  carName: string
  laps: number
  rideAlongLaps: number
  pricePerLap: number
}

export type AdminBookingRow = {
  reference: string
  customerName: string
  customerEmail: string
  customerPhone: string
  carName: string
  laps: number
  /** Full multi-car lineup. Legacy single-car bookings fall back to one line built from carName/laps. */
  cars: AdminBookingCar[]
  total: number
  amountPaid: number
  status: string
  isPrebook: boolean
  experienceDate: string | null
  timeSlot: string | null
  paymentId: string | null
  createdAt: string
  // Stored receipt breakdown (all in ₹) so admin sees discount / add-ons / GST.
  basePrice: number
  discount: number
  addonsPrice: number
  tax: number
  // Number of "reels & photos" add-ons purchased (from the addons jsonb).
  reels: number
  // Laps a co-passenger rode along (from the addons jsonb).
  rideAlongLaps: number
  // Full-fleet one-time-offer upgrade tracking.
  otoPurchased: boolean
  otoAmountPaid: number
  otoBalance: number
  // The complimentary ₹0 Porsche lap unlocked by an upgrade, and its parent booking.
  isBonus: boolean
  parentReference: string | null
  // Self-service reschedule + validity tracking.
  paidInFullAt: string | null
  rescheduleCount: number
  rescheduleFeesPaid: number
}

export type BookingFilters = {
  q?: string
  status?: string
  /** Filter by scheduled experience date window (only confirmed/scheduled bookings). */
  range?: "all" | "today" | "next7"
  /** Sort direction by scheduled drive date (experience_date). asc = oldest→newest. */
  sort?: "asc" | "desc"
  /** Which column the sort direction applies to: the scheduled drive date, or the booked-on date. */
  sortBy?: "date" | "booked"
  page?: number
}

const PAGE_SIZE = 12

export type AdminBookingsPage = {
  rows: AdminBookingRow[]
  total: number
  page: number
  totalPages: number
}

function mapRow(r: Record<string, unknown>): AdminBookingRow {
  const laps = Number(r.laps)
  const rideAlongLaps = Number((r.addons as { rideAlongLaps?: number } | null)?.rideAlongLaps ?? 0)
  // Prefer the stored lineup; fall back to a single line for legacy pre-multi-car bookings.
  const rawCars = r.cars as AdminBookingCar[] | null
  const cars: AdminBookingCar[] =
    Array.isArray(rawCars) && rawCars.length > 0
      ? rawCars.map((c) => ({
          carId: c.carId,
          carName: c.carName,
          laps: Number(c.laps),
          rideAlongLaps: Number(c.rideAlongLaps ?? 0),
          pricePerLap: Number(c.pricePerLap ?? 0),
        }))
      : [{ carId: r.car_id as string, carName: r.car_name as string, laps, rideAlongLaps, pricePerLap: 0 }]

  return {
    reference: r.id as string,
    customerName: r.customer_name as string,
    customerEmail: r.customer_email as string,
    customerPhone: r.customer_phone as string,
    carName: r.car_name as string,
    laps,
    cars,
    total: Number(r.total),
    amountPaid: Number(r.amount_paid),
    status: r.status as string,
    isPrebook: r.is_prebook as boolean,
    experienceDate: (r.experience_date as string) ?? null,
    timeSlot: (r.time_slot as string) ?? null,
    paymentId: (r.payment_id as string) ?? null,
    createdAt: r.created_at as string,
    basePrice: Number(r.base_price ?? 0),
    discount: Number(r.discount ?? 0),
    addonsPrice: Number(r.addons_price ?? 0),
    tax: Number(r.tax ?? 0),
    reels: Number((r.addons as { reels?: number } | null)?.reels ?? 0),
    rideAlongLaps,
    otoPurchased: Boolean(r.oto_purchased),
    otoAmountPaid: Number(r.oto_amount_paid ?? 0),
    otoBalance: Number(r.oto_balance ?? 0),
    isBonus: Boolean(r.is_bonus),
    parentReference: (r.parent_reference as string) ?? null,
    paidInFullAt: r.paid_in_full_at ? new Date(r.paid_in_full_at as string).toISOString() : null,
    rescheduleCount: Number(r.reschedule_count ?? 0),
    rescheduleFeesPaid: Number(r.reschedule_fees_paid ?? 0),
  }
}

/** Paginated, filtered booking list for the admin bookings table. */
export async function getAdminBookings(filters: BookingFilters): Promise<AdminBookingsPage> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`)
    const i = params.length
    conditions.push(
      `(lower(customer_name) LIKE $${i} OR lower(customer_email) LIKE $${i} OR lower(id) LIKE $${i} OR customer_phone LIKE $${i})`,
    )
  }
  // A booking is only a real record once payment succeeds. `pending` rows are in-flight or
  // abandoned checkouts (gateway opened, never paid) — never show them anywhere in admin.
  conditions.push(`status <> 'pending'`)

  if (filters.status === "scheduled") {
    // "Confirmed" and "scheduled" are the same operationally — both are locked-in drives —
    // so the Scheduled filter matches both, and excludes any that have lapsed (shown as Expired).
    conditions.push(
      `status IN ('scheduled', 'confirmed') AND NOT (paid_in_full_at IS NOT NULL AND paid_in_full_at < now() - make_interval(months => ${BOOKING_VALIDITY_MONTHS}))`,
    )
  } else if (filters.status === "cancelled") {
    // "Expired" surfaces both explicitly-cancelled bookings and active drives whose
    // paid-in-full validity window has lapsed (auto-expired, no stored status change).
    conditions.push(
      `(status = 'cancelled' OR (status IN ('scheduled', 'confirmed') AND paid_in_full_at IS NOT NULL AND paid_in_full_at < now() - make_interval(months => ${BOOKING_VALIDITY_MONTHS})))`,
    )
  } else if (filters.status && filters.status !== "all") {
    params.push(filters.status)
    conditions.push(`status = $${params.length}`)
  } else {
    // Default "All statuses" view: real bookings only. Hide cancelled rows that were never
    // paid (e.g. failed payments) so they don't count as records; the "Expired" filter still
    // surfaces them for audit.
    conditions.push(`NOT (status = 'cancelled' AND amount_paid = 0)`)
  }
  // Date-window filters only apply to bookings with a locked-in drive date
  // (confirmed or scheduled). experience_date is stored as ISO text, cast to date to compare.
  if (filters.range === "today") {
    conditions.push(`status IN ('confirmed', 'scheduled') AND experience_date::date = CURRENT_DATE`)
  }
  if (filters.range === "next7") {
    conditions.push(
      `status IN ('confirmed', 'scheduled') AND experience_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`,
    )
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const countRes = await pool.query(`SELECT COUNT(*)::int AS n FROM bookings ${where}`, params)
  const total = countRes.rows[0].n as number
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages)
  const offset = (page - 1) * PAGE_SIZE

  // The sort direction applies to whichever column is active (default: drive date).
  // asc = oldest→newest, desc = newest→oldest.
  const dir = filters.sort === "desc" ? "DESC" : "ASC"
  const orderBy =
    filters.sortBy === "booked"
      ? // "Booked on" column: order purely by when the booking was created.
        `created_at ${dir}`
      : // "Date" column: order by the scheduled drive date. Undated bookings always sort
        // last, and created_at breaks ties so ordering stays stable within a single day.
        `experience_date::date ${dir} NULLS LAST, time_slot ${dir}, created_at DESC`

  const rowsRes = await pool.query(
    `SELECT * FROM bookings ${where} ORDER BY ${orderBy} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    params,
  )

  return { rows: rowsRes.rows.map(mapRow), total, page, totalPages }
}

/** Single booking by reference for the detail drawer. */
export async function getAdminBooking(reference: string): Promise<AdminBookingRow | null> {
  const res = await pool.query(`SELECT * FROM bookings WHERE id = $1`, [reference])
  return res.rows[0] ? mapRow(res.rows[0]) : null
}
