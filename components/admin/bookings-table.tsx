"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AdminBookingsPage, AdminBookingRow, BookingFilters } from "@/lib/turboride/admin-bookings"
import { updateBookingStatus, updateBookingPaymentId } from "@/app/actions/admin-bookings"
import {
  BOOKING_VALIDITY_MONTHS,
  computeBookingValidity,
  describeLaps,
  formatINR,
} from "@/lib/turboride/fleet"
import { gstLabel } from "@/lib/turboride/pricing"
import { Button } from "@/components/ui/button"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Loader2,
  Check,
} from "lucide-react"

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "redeemed", label: "Redeemed" },
  // Stored as "cancelled"; a lapsed (>validity) booking is also surfaced here as Expired.
  { value: "cancelled", label: "Expired" },
  { value: "refunded", label: "Refunded" },
]

/**
 * Derives the status shown to staff. A still-active drive (scheduled/confirmed) whose
 * paid-in-full validity window has lapsed is surfaced as "expired" without changing the
 * stored value. Everything else shows its stored status.
 */
function effectiveStatus(status: string, paidInFullAt: string | null): string {
  if ((status === "scheduled" || status === "confirmed") && computeBookingValidity(paidInFullAt).expired) {
    return "expired"
  }
  return status
}

// Statuses an admin can actually set on a booking (excludes the "all" filter).
const FILTER_ONLY = new Set(["all"])

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "next7", label: "Next 7 days" },
  { value: "all", label: "All-time" },
]

const SETTABLE_STATUSES = STATUS_OPTIONS.filter((s) => !FILTER_ONLY.has(s.value))

/**
 * Per-status visual coding so staff can scan the bookings list at a glance:
 * a tinted row, a colored left accent bar, and a matching status pill.
 * `confirmed` is treated as `scheduled` (green) since the two are merged elsewhere.
 */
const STATUS_STYLE: Record<
  string,
  { label: string; row: string; accent: string; pill: string }
> = {
  scheduled: {
    label: "Scheduled",
    row: "bg-success-muted/40 hover:bg-success-muted/70",
    accent: "border-l-success",
    pill: "bg-success-muted text-success",
  },
  confirmed: {
    label: "Scheduled",
    row: "bg-success-muted/40 hover:bg-success-muted/70",
    accent: "border-l-success",
    pill: "bg-success-muted text-success",
  },
  redeemed: {
    label: "Redeemed",
    row: "bg-muted/50 hover:bg-muted/80 text-muted-foreground",
    accent: "border-l-muted-foreground/40",
    pill: "bg-muted text-muted-foreground",
  },
  refunded: {
    label: "Refunded",
    row: "bg-destructive/5 hover:bg-destructive/15",
    accent: "border-l-destructive/50",
    pill: "bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Expired",
    row: "bg-destructive/15 hover:bg-destructive/25",
    accent: "border-l-destructive",
    pill: "bg-destructive/20 text-destructive",
  },
  expired: {
    label: "Expired",
    row: "bg-destructive/15 hover:bg-destructive/25",
    accent: "border-l-destructive",
    pill: "bg-destructive/20 text-destructive",
  },
}

const STATUS_STYLE_FALLBACK = {
  label: "—",
  row: "hover:bg-muted/50",
  accent: "border-l-transparent",
  pill: "bg-secondary text-muted-foreground",
}

/**
 * A clickable column header that sorts by its column. The active column shows a colored
 * up/down chevron for the current direction; inactive sortable columns show a muted
 * neutral indicator to signal they can be sorted too.
 */
function SortHeader({
  column,
  label,
  activeColumn,
  dir,
  onToggle,
}: {
  column: "date" | "booked"
  label: string
  activeColumn: "date" | "booked"
  dir: "asc" | "desc"
  onToggle: (column: "date" | "booked") => void
}) {
  const active = activeColumn === column
  const thing = column === "booked" ? "booked-on date" : "drive date"
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      title={
        active
          ? dir === "asc"
            ? `Sorted by ${thing}, oldest first — click for newest first`
            : `Sorted by ${thing}, newest first — click for oldest first`
          : `Sort by ${thing}`
      }
      aria-label={
        active
          ? `Sorted by ${thing}, ${dir === "asc" ? "oldest to newest" : "newest to oldest"}. Click to reverse.`
          : `Sort by ${thing}`
      }
      className="-mx-1 flex items-center gap-1 rounded px-1 py-0.5 font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {label}
      {!active ? (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      ) : dir === "asc" ? (
        <ChevronUp className="h-3.5 w-3.5 text-primary" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-primary" />
      )}
    </button>
  )
}

export function BookingsTable({
  data,
  filters,
  lapDistanceKm,
}: {
  data: AdminBookingsPage
  filters: BookingFilters
  /** Standard lap distance (km) from admin Settings — used for regular bookings. */
  lapDistanceKm: number
}) {
  const router = useRouter()
  const [q, setQ] = useState(filters.q ?? "")
  const [selected, setSelected] = useState<AdminBookingRow | null>(null)
  const [pending, startTransition] = useTransition()
  // Which column is currently sorted, and in which direction. The direction drives the
  // active column's indicator; the inactive column shows a neutral, muted indicator.
  const sortDir = filters.sort === "desc" ? "desc" : "asc"
  const sortBy = filters.sortBy === "booked" ? "booked" : "date"

  // Toggle a sortable column: clicking the active column flips direction; clicking an
  // inactive one activates it with a sensible default (soonest drives / newest bookings).
  function toggleSort(column: "date" | "booked") {
    const nextDir = sortBy === column ? (sortDir === "asc" ? "desc" : "asc") : column === "booked" ? "desc" : "asc"
    applyFilters({ sortBy: column, sort: nextDir, page: "1" })
  }

  function applyFilters(next: Partial<Record<string, string>>) {
    const params = new URLSearchParams()
    const merged = {
      q,
      status: filters.status ?? "all",
      range: filters.range ?? "all",
      sort: filters.sort ?? "asc",
      sortBy: filters.sortBy ?? "date",
      ...next,
    }
    if (merged.q) params.set("q", merged.q)
    // Always set status/range explicitly (including "all") so the page's non-"all"
    // defaults don't silently re-apply when a user chooses the unfiltered option.
    if (merged.status) params.set("status", merged.status)
    if (merged.range) params.set("range", merged.range)
    if (merged.sort) params.set("sort", merged.sort)
    // Only persist a non-default sort column to keep the URL clean.
    if (merged.sortBy && merged.sortBy !== "date") params.set("sortBy", merged.sortBy)
    // Page only comes through the Prev/Next buttons (via `next`); any other filter change
    // omits it and resets to page 1. Skip "1" to keep the first-page URL clean.
    if (next.page && next.page !== "1") params.set("page", next.page)
    startTransition(() => router.push(`/admin/bookings?${params.toString()}`))
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters({ q })
          }}
          className="relative min-w-0 flex-1 sm:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, ref…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </form>

        <select
          value={filters.status ?? "all"}
          onChange={(e) => applyFilters({ status: e.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filters.range ?? "all"}
          onChange={(e) => applyFilters({ range: e.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          {DATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Car</th>
                <th className="px-4 py-3 font-medium">
                  <SortHeader column="date" label="Date" activeColumn={sortBy} dir={sortDir} onToggle={toggleSort} />
                </th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Add-ons</th>
                <th className="px-4 py-3 font-medium">
                  <SortHeader
                    column="booked"
                    label="Booked on"
                    activeColumn={sortBy}
                    dir={sortDir}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    No bookings match your filters.
                  </td>
                </tr>
              ) : (
                data.rows.map((b) => {
                  const st = STATUS_STYLE[effectiveStatus(b.status, b.paidInFullAt)] ?? STATUS_STYLE_FALLBACK
                  const balance = b.total - b.amountPaid
                  return (
                  <tr
                    key={b.reference}
                    onClick={() => setSelected(b)}
                    className={`cursor-pointer border-b border-border last:border-0 transition-colors ${st.row}`}
                  >
                    <td className={`px-4 py-3 border-l-4 ${st.accent}`}>
                      <p className="font-medium text-foreground">{b.customerName}</p>
                      <p className="text-xs text-muted-foreground">{b.customerPhone || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.pill}`}
                        >
                          {st.label}
                        </span>
                        {balance > 0 && st.label === "Scheduled" && (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-warning-muted px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
                            Balance due
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {b.cars.length > 1 ? (
                        <>
                          <p className="text-foreground">
                            {b.cars[0].carName}{" "}
                            <span className="text-muted-foreground">+{b.cars.length - 1} more</span>
                          </p>
                          <p className="text-xs font-medium text-primary">
                            {b.cars.length} cars · {describeLaps({ laps: b.laps, lapDistanceKm })}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-foreground">{b.carName}</p>
                          <p className="text-xs font-medium text-primary">
                            {describeLaps({ laps: b.laps, lapDistanceKm })}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">{b.experienceDate ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{b.timeSlot ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">
                      {[
                        b.reels > 0 ? `${b.reels} Reel${b.reels > 1 ? "s" : ""}` : null,
                        b.rideAlongLaps > 0
                          ? `Co-passenger ${b.rideAlongLaps} lap${b.rideAlongLaps > 1 ? "s" : ""}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
                      {new Date(b.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(b.createdAt).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{formatINR(b.total)}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(b.amountPaid)} paid</p>
                    </td>
                    <td className="px-4 py-3">
                      {balance > 0 ? (
                        <span className="font-semibold text-destructive">{formatINR(balance)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => applyFilters({ page: String(data.page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => applyFilters({ page: String(data.page + 1) })}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <BookingDrawer
          booking={selected}
          lapDistanceKm={lapDistanceKm}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}

function BookingDrawer({
  booking,
  lapDistanceKm,
  onClose,
  onChanged,
}: {
  booking: AdminBookingRow
  lapDistanceKm: number
  onClose: () => void
  onChanged: () => void
}) {
  // "confirmed" is merged into "scheduled" — show it as scheduled in the editable select.
  const [status, setStatus] = useState(booking.status === "confirmed" ? "scheduled" : booking.status)
  const [paymentId, setPaymentId] = useState(booking.paymentId ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const noop: { ok: true; error?: string } = { ok: true }
    const [s, p] = await Promise.all([
      status !== booking.status ? updateBookingStatus(booking.reference, status) : Promise.resolve(noop),
      paymentId !== (booking.paymentId ?? "")
        ? updateBookingPaymentId(booking.reference, paymentId)
        : Promise.resolve(noop),
    ])
    setSaving(false)
    if (!s.ok || !p.ok) {
      setError(("error" in s && s.error) || ("error" in p && p.error) || "Could not save changes.")
      return
    }
    onChanged()
  }

  // One-click venue action: mark the drive as completed. Settles any balance to zero
  // (handled server-side) and closes the booking out as redeemed.
  const isActiveDrive = booking.status === "scheduled" || booking.status === "confirmed"
  async function markRedeemed() {
    setSaving(true)
    setError(null)
    const res = await updateBookingStatus(booking.reference, "redeemed")
    setSaving(false)
    if (!res.ok) {
      setError(res.error || "Could not mark as redeemed.")
      return
    }
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/40" />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display font-bold text-foreground">Booking details</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="font-display text-lg font-bold text-foreground">{booking.customerName}</p>
            <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
            <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <Field label="Reference" value={booking.reference} mono />
            <Field
              label="Booked on"
              value={new Date(booking.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            />
            <Field
              label="Add-ons"
              value={
                [
                  booking.reels > 0 ? `${booking.reels} × Reels & photos` : null,
                  booking.rideAlongLaps > 0
                    ? `Co-passenger on ${booking.rideAlongLaps} lap${booking.rideAlongLaps > 1 ? "s" : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "None"
              }
            />
            {booking.experienceDate && <Field label="Date" value={booking.experienceDate} />}
            {booking.timeSlot && <Field label="Slot" value={booking.timeSlot} />}
          </dl>

          {/* Car lineup — driven back-to-back in the same slot. */}
          <div className="rounded-xl border border-border p-4">
            <p className="mb-3 font-display text-sm font-bold text-foreground">
              {booking.cars.length > 1 ? `Car lineup (${booking.cars.length})` : "Car"}
            </p>
            <ul className="space-y-2 text-sm">
              {booking.cars.map((c, i) => (
                <li key={`${c.carId}-${i}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    {booking.cars.length > 1 && <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>}
                    <span className="font-medium text-foreground">{c.carName}</span>
                    {c.rideAlongLaps > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · co-passenger {c.rideAlongLaps} lap{c.rideAlongLaps > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-primary">
                    {describeLaps({ laps: c.laps, lapDistanceKm })}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Validity + reschedule history — helps staff spot no-shows and fee status at the venue. */}
          {(() => {
            const { deadline, expired } = computeBookingValidity(booking.paidInFullAt)
            return (
              <div className="rounded-xl border border-border p-4">
                <p className="mb-3 font-display text-sm font-bold text-foreground">Validity &amp; reschedules</p>
                <dl className="space-y-2 text-sm">
                  <ReceiptRow
                    label={`Valid until (${BOOKING_VALIDITY_MONTHS}mo)`}
                    value={
                      booking.paidInFullAt && deadline
                        ? `${new Date(deadline).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}${expired ? " · EXPIRED" : ""}`
                        : "Not yet paid in full"
                    }
                    strong={expired}
                  />
                  <ReceiptRow label="Rescheduled" value={`${booking.rescheduleCount} time(s)`} muted />
                  {booking.rescheduleFeesPaid > 0 && (
                    <ReceiptRow label="Reschedule fees" value={formatINR(booking.rescheduleFeesPaid)} muted />
                  )}
                </dl>
              </div>
            )
          })()}

          {/* Payment breakdown */}
          <div className="rounded-xl border border-border p-4">
            <p className="mb-3 font-display text-sm font-bold text-foreground">Payment breakdown</p>
            <dl className="space-y-2 text-sm">
              {booking.cars.length > 1 ? (
                <>
                  {booking.cars.map((c, i) => (
                    <ReceiptRow
                      key={`${c.carId}-${i}`}
                      label={`${c.carName} — ${c.laps} lap${c.laps > 1 ? "s" : ""}`}
                      value={c.pricePerLap > 0 ? formatINR(c.pricePerLap * c.laps) : "—"}
                    />
                  ))}
                  <ReceiptRow label="Cars subtotal" value={formatINR(booking.basePrice)} muted />
                </>
              ) : (
                <ReceiptRow
                  label={`${booking.carName} — ${booking.laps} lap${booking.laps > 1 ? "s" : ""}`}
                  value={formatINR(booking.basePrice)}
                />
              )}
              {booking.discount > 0 && (
                <ReceiptRow label="Full-pay discount" value={`− ${formatINR(booking.discount)}`} />
              )}
              {booking.addonsPrice > 0 && (
                <ReceiptRow
                  label={`Add-ons (${[
                    booking.reels > 0 ? `${booking.reels} × Reels & photos` : null,
                    booking.rideAlongLaps > 0 ? `co-passenger × ${booking.rideAlongLaps}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")})`}
                  value={formatINR(booking.addonsPrice)}
                />
              )}
              <ReceiptRow
                label={gstLabel(booking.tax, booking.basePrice - booking.discount + booking.addonsPrice)}
                value={formatINR(booking.tax)}
              />
              <div className="border-t border-border pt-2">
                <ReceiptRow label="Total" value={formatINR(booking.total)} strong />
                <ReceiptRow
                  label={booking.rescheduleFeesPaid > 0 ? "Paid (drive)" : "Paid"}
                  value={formatINR(booking.amountPaid)}
                  muted
                />
                {booking.total - booking.amountPaid > 0 && (
                  <ReceiptRow label="Balance due" value={formatINR(booking.total - booking.amountPaid)} muted />
                )}
              </div>
              {booking.rescheduleFeesPaid > 0 && (
                <div className="border-t border-border pt-2">
                  <ReceiptRow
                    label={`Reschedule fee${booking.rescheduleCount > 1 ? `s (${booking.rescheduleCount})` : ""}`}
                    value={formatINR(booking.rescheduleFeesPaid)}
                    muted
                  />
                  <ReceiptRow
                    label="Total paid"
                    value={formatINR(booking.amountPaid + booking.rescheduleFeesPaid)}
                    strong
                  />
                </div>
              )}
            </dl>
          </div>

          {isActiveDrive && (
            <div className="rounded-xl border border-primary/30 bg-accent p-4">
              <p className="font-display text-sm font-bold text-foreground">Guest completed their drive?</p>
              <p className="mt-0.5 mb-3 text-sm text-muted-foreground text-pretty">
                Mark this booking as redeemed once they finish at the venue. Any outstanding balance is cleared.
              </p>
              <Button onClick={markRedeemed} disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" strokeWidth={3} />
                )}
                Mark as redeemed
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {SETTABLE_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Payment (Razorpay) ID</label>
            <input
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_XXXXXXXXXXXX"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              Stored for reconciliation. Live Razorpay capture activates once payments are connected.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="mt-auto flex gap-2 border-t border-border p-5">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  )
}

function ReceiptRow({
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
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? "font-display text-base font-extrabold text-primary" : muted ? "text-muted-foreground" : "font-medium text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  )
}
