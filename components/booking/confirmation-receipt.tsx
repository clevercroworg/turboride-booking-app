import { formatINR } from "@/lib/turboride/fleet"
import type { BookingCarLine } from "@/app/actions/booking"
import { CalendarClock, CheckCircle2, Clock3, Mail, MapPin } from "lucide-react"
import Link from "next/link"

export type ReceiptBooking = {
  reference: string
  cars: BookingCarLine[]
  reels: number
  date: string | null
  slot: string | null
  email: string
  status: string
  basePrice: number
  addonsPrice: number
  discount: number
  tax: number
  total: number
  amountPaid: number
}

/**
 * Server-rendered receipt shown on the post-redirect confirmation page. Unlike the
 * wizard's inline confirmation (which has the full live price breakdown in memory), this
 * reconstructs a faithful receipt purely from the stored booking columns.
 */
export function ConfirmationReceipt({
  booking,
  pending,
  locationCoords,
}: {
  booking: ReceiptBooking
  pending: boolean
  locationCoords?: string
}) {
  const coords = (() => {
    if (!locationCoords) return null
    const [lat, lng] = locationCoords.split(",").map((n) => Number(n.trim()))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat, lng }
  })()

  const prettyDate = booking.date
    ? new Date(booking.date + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const isPayAtVenue = booking.discount === 0
  const advanceAmount = isPayAtVenue ? Math.min(1000, booking.total) : booking.total
  const currentPaid = booking.amountPaid > 0 ? booking.amountPaid : (pending ? advanceAmount : 0)
  const balanceAtVenue = isPayAtVenue ? Math.max(0, booking.total - (booking.amountPaid > 0 ? booking.amountPaid : advanceAmount)) : Math.max(0, booking.total - booking.amountPaid)

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        {pending ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Clock3 className="h-7 w-7" />
          </span>
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 className="h-7 w-7" />
          </span>
        )}
        <h1 className="mt-4 text-2xl font-bold text-foreground text-balance sm:text-3xl">
          {pending ? "Payment processing" : "Booking confirmed"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground text-pretty">
          {pending
            ? "We've received your payment and are waiting for the gateway to confirm. This page will reflect the final status shortly — a confirmation email follows once settled."
            : "Your highway drive slot is locked in. We've emailed your confirmation and details."}
        </p>
        <p className="mt-4 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground">
          Ref <span className="font-mono font-semibold">{booking.reference}</span>
        </p>
      </div>

      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={CalendarClock} label="Date & slot" value={[prettyDate, booking.slot].filter(Boolean).join(" · ") || "To be scheduled"} />
          <InfoRow icon={Mail} label="Confirmation sent to" value={booking.email} />
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your session</p>
          <ul className="mt-2 space-y-1.5">
            {booking.cars.map((c, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{c.carName}</span>
                <span className="text-muted-foreground">
                  {c.laps} {c.laps === 1 ? "lap" : "laps"}
                  {c.rideAlongLaps > 0 ? ` · ${c.rideAlongLaps} ride-along` : ""}
                </span>
              </li>
            ))}
            {booking.reels > 0 && (
              <li className="flex items-center justify-between text-sm">
                <span className="text-foreground">Pro reels</span>
                <span className="text-muted-foreground">{booking.reels}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="border-t border-border pt-4">
          <ReceiptLine label="Base fare" value={formatINR(booking.basePrice)} />
          {booking.addonsPrice > 0 && <ReceiptLine label="Add-ons" value={formatINR(booking.addonsPrice)} />}
          {booking.discount > 0 && <ReceiptLine label="Full-pay discount (15%)" value={`- ${formatINR(booking.discount)}`} />}
          <ReceiptLine label="GST (18%)" value={formatINR(booking.tax)} />
          <div className="my-2 border-t border-border" />
          <ReceiptLine label="Total Drive Value" value={formatINR(booking.total)} strong />
          {isPayAtVenue ? (
            <>
              <ReceiptLine
                label={pending ? "Advance being processed" : "Advance paid online"}
                value={formatINR(currentPaid)}
                strong
              />
              <ReceiptLine
                label="Balance (pay at venue on drive day)"
                value={formatINR(balanceAtVenue)}
                muted
              />
            </>
          ) : (
            <ReceiptLine
              label={pending ? "Amount being processed" : "Total paid"}
              value={formatINR(currentPaid > 0 ? currentPaid : booking.total)}
              strong
            />
          )}
        </div>
      </div>

      {coords && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Venue location</span>
          </div>
          <iframe
            title="Venue location map"
            className="h-56 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
          />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/account"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          View in my account
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function ReceiptLine({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={strong ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </span>
      <span className={strong ? "font-bold text-foreground" : muted ? "text-muted-foreground" : "text-foreground"}>
        {value}
      </span>
    </div>
  )
}
