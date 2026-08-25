import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { pool } from "@/lib/db"
import { getPublicSettings } from "@/lib/turboride/settings"
import type { BookingCarLine } from "@/app/actions/booking"
import { ConfirmationReceipt, type ReceiptBooking } from "@/components/booking/confirmation-receipt"

/**
 * Standalone confirmation page shown after a real gateway payment redirects back
 * (via /book/callback). Reads the booking straight from the DB by reference — the
 * reference is unguessable, so it doubles as the access token for this receipt.
 */
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { reference } = await params
  const { status: statusParam } = await searchParams

  const res = await pool.query(
    `SELECT id, car_id, car_name, laps, addons, cars, experience_date, time_slot,
            customer_email, status, base_price, addons_price, discount, tax, total, amount_paid
     FROM bookings WHERE id = $1`,
    [reference],
  )
  const row = res.rows[0]
  if (!row) notFound()

  const settings = await getPublicSettings()

  const rawCars = row.cars as BookingCarLine[] | null
  const cars: BookingCarLine[] =
    Array.isArray(rawCars) && rawCars.length > 0
      ? rawCars
      : [
          {
            carId: row.car_id,
            carName: row.car_name,
            laps: Number(row.laps),
            rideAlongLaps: Number(row.addons?.rideAlongLaps ?? 0),
            pricePerLap: 0,
          },
        ]

  const booking: ReceiptBooking = {
    reference: row.id,
    cars,
    reels: Number(row.addons?.reels ?? 0),
    date: row.experience_date,
    slot: row.time_slot,
    email: row.customer_email,
    status: row.status,
    basePrice: Number(row.base_price ?? 0),
    addonsPrice: Number(row.addons_price ?? 0),
    discount: Number(row.discount ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    amountPaid: Number(row.amount_paid ?? 0),
  }

  // "pending" means the gateway hasn't confirmed yet (customer returned before capture);
  // the webhook will finalise it. Show a softer state until then.
  const pending = statusParam === "pending" || row.status === "pending"

  return (
    <main className="min-h-dvh bg-background">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <ConfirmationReceipt booking={booking} pending={pending} locationCoords={settings.locationCoords} />
      </div>
    </main>
  )
}
