"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AlertTriangle, CalendarClock, Check, CreditCard, Info, Loader2, RefreshCw, Sparkles } from "lucide-react"
import {
  BOOKING_VALIDITY_MONTHS,
  computeBookingValidity,
  findCar,
  formatINR,
  rescheduleFeeFor,
  type Car,
} from "@/lib/turboride/fleet"
import { discountedFullPayTotal } from "@/lib/turboride/pricing"
import { DateTimeStep } from "@/components/booking/datetime-step"
import type { PublicAvailability } from "@/lib/turboride/schedule"
import { payBalance, rescheduleBooking, type MyAccount, type MyBooking } from "@/app/actions/booking"

export function AccountDashboard({
  account,
  fleet,
  availability,
  lapDistanceKm = 15,
  minLeadDays = 1,
  discountRate = 0,
  gstRate = 0.18,
}: {
  account: MyAccount
  fleet: Car[]
  /** Slot capacities, blackout dates, and booked counts (from admin Schedule config). */
  availability?: PublicAvailability
  /** Distance per lap in km (from admin Settings). */
  lapDistanceKm?: number
  /** Minimum booking lead time in days (from admin Settings). Applies to reschedules too. */
  minLeadDays?: number
  /** Full-pay discount rate (fraction) — powers the "pay balance & save" offer. */
  discountRate?: number
  /** GST rate (fraction) — used to re-price the discounted balance for display. */
  gstRate?: number
}) {
  const { bookings, identifier } = account

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">My account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{identifier}</span>
        </p>
      </div>

      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No bookings on this account yet.</p>
            <Button nativeButton={false} render={<a href="/#book">Book a drive</a>} className="mt-4" />
          </div>
        ) : (
          bookings.map((b) => (
            <BookingCard
              key={b.reference}
              booking={b}
              fleet={fleet}
              availability={availability}
              lapDistanceKm={lapDistanceKm}
              minLeadDays={minLeadDays}
              discountRate={discountRate}
              gstRate={gstRate}
            />
          ))
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, expired }: { status: string; expired: boolean }) {
  const effective = expired && (status === "scheduled" || status === "confirmed") ? "expired" : status
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "Scheduled", cls: "bg-success-muted text-success" },
    confirmed: { label: "Confirmed", cls: "bg-success-muted text-success" },
    redeemed: { label: "Redeemed · drive complete", cls: "bg-primary text-primary-foreground" },
    cancelled: { label: "Expired", cls: "bg-destructive/10 text-destructive" },
    expired: { label: "Expired", cls: "bg-destructive/10 text-destructive" },
    refunded: { label: "Refunded", cls: "bg-secondary text-muted-foreground" },
  }
  const s = map[effective] ?? { label: effective, cls: "bg-secondary text-muted-foreground" }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

/** Local-time `YYYY-MM-DD` from an ISO string (for the date picker's max bound). */
function ymdLocal(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Friendly deadline label, e.g. "19 Nov 2026". */
function fmtDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** A single label/amount row inside the breakdown popover. */
function BreakdownRow({
  label,
  amount,
  muted = false,
  strong = false,
  negative = false,
}: {
  label: ReactNode
  amount: string
  muted?: boolean
  strong?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={muted ? "text-muted-foreground" : strong ? "font-semibold text-foreground" : "text-foreground"}>
        {label}
      </span>
      <span
        className={
          negative
            ? "font-medium text-success"
            : strong
              ? "font-display font-bold text-primary"
              : muted
                ? "text-muted-foreground"
                : "text-foreground"
        }
      >
        {negative ? `– ${amount}` : amount}
      </span>
    </div>
  )
}

/**
 * Info icon that reveals the itemised payment breakdown on hover/focus. Figures come
 * straight from what was charged (base fare per car, the discount actually applied, add-ons,
 * and GST), so the customer sees exactly how their total was built. No portal/dependency —
 * a CSS group-hover popover, opened rightward so the overflow-visible card never clips it.
 */
function PaymentBreakdown({
  booking,
  balance,
  lapDistanceKm,
  gstRate,
}: {
  booking: MyBooking
  balance: number
  lapDistanceKm: number
  gstRate: number
}) {
  const rideAlong = booking.cars.reduce((s, l) => s + l.rideAlongLaps, 0) || booking.rideAlongLaps
  const addonParts: string[] = []
  if (booking.reels > 0) addonParts.push(`${booking.reels} × Reels & photos`)
  if (rideAlong > 0) addonParts.push(`co-passenger ${rideAlong} lap${rideAlong > 1 ? "s" : ""}`)

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="View payment breakdown"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <div
        role="tooltip"
        className="invisible absolute left-0 top-full z-30 mt-2 w-72 origin-top-left rounded-xl border border-border bg-card p-4 text-left text-sm opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <p className="mb-3 font-display text-sm font-bold text-foreground">Payment breakdown</p>
        <div className="space-y-1.5">
          {booking.cars.map((l, i) => {
            const lineAmount = l.pricePerLap * l.laps
            return (
              <BreakdownRow
                key={`${l.carId}-${i}`}
                label={`${l.carName} — ${l.laps} lap${l.laps > 1 ? "s" : ""}`}
                amount={lineAmount > 0 ? formatINR(lineAmount) : "—"}
              />
            )
          })}
          <div className="my-2 border-t border-border" />
          <BreakdownRow label="Cars subtotal" amount={formatINR(booking.basePrice)} muted />
          {booking.discount > 0 && (
            <BreakdownRow label="Full-pay discount" amount={formatINR(booking.discount)} negative />
          )}
          {booking.addonsPrice > 0 && (
            <BreakdownRow
              label={addonParts.length > 0 ? `Add-ons (${addonParts.join(" · ")})` : "Add-ons"}
              amount={formatINR(booking.addonsPrice)}
            />
          )}
          <BreakdownRow label={`GST (${Math.round(gstRate * 100)}%)`} amount={formatINR(booking.tax)} />
          <div className="my-2 border-t border-border" />
          <BreakdownRow label="Total" amount={formatINR(booking.total)} strong />
          <BreakdownRow label={booking.rescheduleFeesPaid > 0 ? "Paid (drive)" : "Paid"} amount={formatINR(booking.amountPaid)} muted />
          {balance > 0 && <BreakdownRow label="Balance due" amount={formatINR(balance)} />}
          {booking.rescheduleFeesPaid > 0 && (
            <>
              <BreakdownRow
                label={`Reschedule fee${booking.rescheduleCount > 1 ? `s (${booking.rescheduleCount})` : ""}`}
                amount={formatINR(booking.rescheduleFeesPaid)}
                muted
              />
              <div className="my-2 border-t border-border" />
              <BreakdownRow
                label="Total paid"
                amount={formatINR(booking.amountPaid + booking.rescheduleFeesPaid)}
                strong
              />
            </>
          )}
        </div>
      </div>
    </span>
  )
}

function BookingCard({
  booking,
  fleet,
  availability,
  lapDistanceKm,
  minLeadDays,
  discountRate,
  gstRate,
}: {
  booking: MyBooking
  fleet: Car[]
  availability?: PublicAvailability
  lapDistanceKm: number
  minLeadDays: number
  discountRate: number
  gstRate: number
}) {
  const router = useRouter()
  const car = findCar(fleet, booking.carId)
  const reels = booking.reels
  // The lineup drives the card's car list; a legacy booking has a single line.
  const lineup = booking.cars
  const multiCar = lineup.length > 1
  const totalLaps = lineup.reduce((sum, l) => sum + l.laps, 0)

  // Self-service reschedule of an already-locked drive.
  const [reschedOpen, setReschedOpen] = useState(false)
  const [reschedDate, setReschedDate] = useState<string | null>(null)
  const [reschedSlot, setReschedSlot] = useState<string | null>(null)
  const [reschedSaving, setReschedSaving] = useState(false)

  // Validity window (3 months from full payment) + the fee due for the next reschedule.
  const validity = computeBookingValidity(booking.paidInFullAt)
  const hasSchedule = Boolean(booking.date) && (booking.status === "scheduled" || booking.status === "confirmed")
  const nextRescheduleFee = rescheduleFeeFor(booking.rescheduleCount)

  async function confirmReschedule() {
    if (!reschedDate || !reschedSlot) {
      toast.error("Choose a new date and time slot.")
      return
    }
    setReschedSaving(true)
    try {
      const res = await rescheduleBooking({ reference: booking.reference, date: reschedDate, slot: reschedSlot })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        res.feeCharged > 0
          ? `Reschedule fee ${formatINR(res.feeCharged)} paid — your drive moved to the new date.`
          : "Rescheduled free of charge — your drive moved to the new date.",
      )
      setReschedOpen(false)
      setReschedDate(null)
      setReschedSlot(null)
      router.refresh()
    } catch {
      toast.error("Couldn't reschedule. Please try again.")
    } finally {
      setReschedSaving(false)
    }
  }

  const balance = Math.max(0, booking.total - booking.amountPaid)

  // Balance settlement: paying online now re-prices with the full-pay discount, so the
  // customer pays the discounted remainder instead of the full undiscounted venue balance.
  const [paying, setPaying] = useState(false)
  const discountedTotal = discountedFullPayTotal(booking.basePrice, booking.addonsPrice, discountRate, gstRate)
  const onlineDue = Math.max(0, discountedTotal - booking.amountPaid)
  const balanceSavings = Math.max(0, booking.total - discountedTotal)
  const canPayBalance =
    balance > 0 && !validity.expired && (booking.status === "scheduled" || booking.status === "confirmed")

  async function handlePayBalance() {
    setPaying(true)
    try {
      const res = await payBalance({ reference: booking.reference })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // Real gateway active: hand off to hosted checkout to clear the balance.
      if (!res.simulated && res.redirectUrl) {
        toast.info("Redirecting to secure payment…")
        window.location.href = res.redirectUrl
        return
      }
      toast.success(
        res.saved > 0
          ? `Balance settled — you paid ${formatINR(res.paidOnline)} and saved ${formatINR(res.saved)} with the full-pay discount.`
          : `Balance settled — you paid ${formatINR(res.paidOnline)}. See you on the highway!`,
      )
      router.refresh()
    } catch {
      toast.error("Couldn't process the payment. Please try again.")
    } finally {
      setPaying(false)
    }
  }

  const prettyDate = booking.date
    ? new Date(booking.date + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
          <Image
            src={car?.image || "/placeholder.svg"}
            alt={booking.carName}
            fill
            className="object-contain p-1"
            sizes="96px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-bold text-foreground">
              {multiCar ? `${lineup.length}-car session` : booking.carName}
            </p>
            <StatusBadge status={booking.status} expired={validity.expired} />
          </div>
          {multiCar ? (
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {lineup.map((l, i) => (
                <li key={`${l.carId}-${i}`}>
                  <span className="font-medium text-foreground">{l.carName}</span> — {l.laps} lap
                  {l.laps > 1 ? "s" : ""} · {l.laps * lapDistanceKm} km
                  {l.rideAlongLaps > 0 ? ` · co-passenger ${l.rideAlongLaps} lap${l.rideAlongLaps > 1 ? "s" : ""}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {totalLaps} lap{totalLaps > 1 ? "s" : ""} · {totalLaps * lapDistanceKm} km
              {lineup[0]?.rideAlongLaps > 0
                ? ` · co-passenger ${lineup[0].rideAlongLaps} lap${lineup[0].rideAlongLaps > 1 ? "s" : ""}`
                : ""}
            </p>
          )}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {reels > 0 ? `${reels} reel${reels > 1 ? "s" : ""} · ` : ""}Ref{" "}
            <span className="font-mono text-foreground">{booking.reference}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
            {prettyDate ? (
              <span className="flex items-center gap-1 text-foreground">
                <CalendarClock className="h-3.5 w-3.5 text-primary" /> {prettyDate} · {booking.slot}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> Not scheduled
              </span>
            )}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span>
                Paid {formatINR(booking.amountPaid)}
                {balance > 0 ? ` · Balance ${formatINR(balance)}` : ""}
              </span>
              <PaymentBreakdown
                booking={booking}
                balance={balance}
                lapDistanceKm={lapDistanceKm}
                gstRate={gstRate}
              />
            </span>
          </div>
        </div>
      </div>

      {booking.status === "redeemed" ? (
        <div className="border-t border-border p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-foreground">Drive completed · redeemed</p>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                {prettyDate ? `You drove on ${prettyDate}. ` : ""}Thanks for hitting the highway with us — we hope it
                was unforgettable. See you next time!
              </p>
            </div>
          </div>
        </div>
      ) : hasSchedule && validity.expired ? (
        <div className="border-t border-border p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-foreground">Validity expired · no-show</p>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                This booking passed its {BOOKING_VALIDITY_MONTHS}-month validity window
                {validity.deadline ? ` (ended ${fmtDeadline(validity.deadline)})` : ""} and is marked as a no-show. No
                refund or reschedule is available.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {canPayBalance && (
            <div className="border-t border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" /> Settle your balance
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                    You&apos;ve paid {formatINR(booking.amountPaid)}. Pay the remaining{" "}
                    <span className="font-medium text-foreground">{formatINR(balance)}</span> at the venue on drive
                    day
                    {balanceSavings > 0 ? (
                      <>
                        {" "}
                        — or clear it online now and claim the {Math.round(discountRate * 100)}% full-pay discount,
                        paying just{" "}
                        <span className="font-semibold text-foreground">{formatINR(onlineDue)}</span> online.
                      </>
                    ) : (
                      <> — or pay it online now, whenever you&apos;re ready.</>
                    )}
                  </p>
                  {balanceSavings > 0 && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Pay online and save {formatINR(balanceSavings)}
                    </p>
                  )}
                </div>
                <Button onClick={handlePayBalance} disabled={paying} className="shrink-0 min-w-44">
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-1.5 h-4 w-4" /> Pay {formatINR(onlineDue)}
                      {balanceSavings > 0 ? " & save" : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          {hasSchedule && (
        <div className="border-t border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
                <RefreshCw className="h-4 w-4 text-primary" /> Need a different day?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                {validity.deadline
                  ? `Move your drive to any open day up to ${fmtDeadline(validity.deadline)}. `
                  : "Move your drive to another available day. "}
                {nextRescheduleFee > 0
                  ? `A ${formatINR(nextRescheduleFee)} reschedule fee applies.`
                  : "Your first reschedule is free."}
              </p>
            </div>
            {!reschedOpen && (
              <Button variant="outline" onClick={() => setReschedOpen(true)} className="shrink-0">
                <RefreshCw className="mr-1.5 h-4 w-4" /> Reschedule
              </Button>
            )}
          </div>

          {reschedOpen && (
            <div className="mt-4 border-t border-border pt-4">
              <DateTimeStep
                date={reschedDate}
                slot={reschedSlot}
                onDateChange={setReschedDate}
                onSlotChange={setReschedSlot}
                availability={availability}
                maxDate={validity.deadline ? ymdLocal(validity.deadline) : null}
                minLeadDays={minLeadDays}
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReschedOpen(false)
                    setReschedDate(null)
                    setReschedSlot(null)
                  }}
                  disabled={reschedSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmReschedule}
                  disabled={reschedSaving || !reschedDate || !reschedSlot}
                  className="min-w-44"
                >
                  {reschedSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rescheduling…
                    </>
                  ) : nextRescheduleFee > 0 ? (
                    <>Pay {formatINR(nextRescheduleFee)} &amp; reschedule</>
                  ) : (
                    <>Reschedule for free</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
          )}
        </>
      )}
    </div>
  )
}
