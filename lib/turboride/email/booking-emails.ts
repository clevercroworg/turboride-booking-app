import "server-only"
import { pool } from "@/lib/db"
import { getSettings } from "@/lib/turboride/settings"
import { renderMergeTags } from "@/lib/turboride/email-templates"
import { getOrigin } from "@/lib/turboride/payments"
import { sendEmail } from "./index"

/** Format a stored ISO date (YYYY-MM-DD) as a friendly date for email bodies. */
function prettyDate(date: string | null): string {
  if (!date) return "To be scheduled"
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Send the booking-confirmation email for a settled booking, if that automated email
 * is enabled. Merge tags are substituted from the booking + settings. Safe to call more
 * than once (respects simulation); callers don't need to await the result to proceed.
 */
export async function sendBookingConfirmation(reference: string): Promise<void> {
  try {
    const tpl = await pool.query(
      `SELECT subject, body, enabled FROM email_templates WHERE key = 'booking_confirmation'`,
    )
    const template = tpl.rows[0]
    if (!template || template.enabled === false) return

    const res = await pool.query(
      `SELECT id, car_name, laps, cars, experience_date, time_slot, customer_name, customer_email,
              total, amount_paid
       FROM bookings WHERE id = $1`,
      [reference],
    )
    const b = res.rows[0]
    if (!b || !b.customer_email) return

    const settings = await getSettings()
    const origin = await getOrigin()
    const balance = Math.max(0, Number(b.total) - Number(b.amount_paid))

    // Format car summary: if multiple cars are in the lineup, list them nicely
    let carDescription = b.car_name || ""
    if (Array.isArray(b.cars) && b.cars.length > 0) {
      carDescription = b.cars
        .map((c: { carName?: string; laps?: number }) => `${c.carName || "Supercar"} (${c.laps || 1} ${Number(c.laps) === 1 ? "lap" : "laps"})`)
        .join(" + ")
    }

    const values: Record<string, string | number> = {
      name: b.customer_name || "Driver",
      car: carDescription,
      reference: b.id,
      laps: Number(b.laps) || 0,
      date: prettyDate(b.experience_date),
      slot: b.time_slot || "",
      amountPaid: `₹${Number(b.amount_paid).toLocaleString("en-IN")}`,
      balance: `₹${balance.toLocaleString("en-IN")}`,
      location: settings.location,
      login: `${origin}/account`,
    }

    await sendEmail({
      to: b.customer_email,
      subject: renderMergeTags(template.subject, values),
      body: renderMergeTags(template.body, values),
    })
  } catch (err) {
    // Email must never block the booking flow — log and move on.
    console.log("[v0] sendBookingConfirmation failed:", err instanceof Error ? err.message : err)
  }
}
