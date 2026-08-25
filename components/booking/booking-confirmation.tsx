"use client"

import { type ReactNode, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { formatINR, GST_RATE } from "@/lib/turboride/fleet"
import {
  DEFAULT_DISCOUNT_RATES,
  fullPayTotal,
  gstLabel,
  type CarLine,
  type DiscountRates,
  type PaymentOption,
  type PriceBreakdown,
} from "@/lib/turboride/pricing"
import type { Contact } from "./checkout-step"
import { CalendarClock, CheckCircle2, Mail, MapPin } from "lucide-react"

export type ConfirmationData = {
  reference: string
  cars: CarLine[]
  date: string | null
  slot: string | null
  payment: PaymentOption
  price: PriceBreakdown
  contact: Contact
}

export function BookingConfirmation({
  data,
  discountRates = DEFAULT_DISCOUNT_RATES,
  gstRate = GST_RATE,
  locationCoords,
}: {
  data: ConfirmationData
  /** Full-pay discount rates (from admin Settings) — powers the "if paid online" figure. */
  discountRates?: DiscountRates
  /** GST rate as a fraction (from admin Settings). */
  gstRate?: number
  /** Venue coordinates "lat, lng" (from admin Settings) — powers the embedded map square. */
  locationCoords?: string
}) {
  // Parse "lat, lng" into a validated pair so we only embed a map for well-formed coords.
  const coords = (() => {
    if (!locationCoords) return null
    const [lat, lng] = locationCoords.split(",").map((n) => Number(n.trim()))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat, lng }
  })()
  const prettyDate = data.date
    ? new Date(data.date + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const payAtVenue = data.price.payAtVenue
  const onlineTotal = fullPayTotal(data.price, discountRates, gstRate)

  // Bring the confirmation into view on mount so it starts cleanly at the "Booking
  // Confirmed" header, matching the per-step scroll behaviour of the wizard.
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-24">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-2 border-b border-border bg-success-muted px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h2 className="font-display text-2xl font-extrabold text-foreground">Booking Confirmed</h2>
          <p className="text-sm text-muted-foreground">
            Reference <span className="font-mono font-semibold text-foreground">{data.reference}</span>
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail icon={CalendarClock} label="Drive schedule" value={`${prettyDate} · ${data.slot}`} />
            <Detail
              icon={MapPin}
              label="Venue"
              value={
                <>
                  <a
                    href={
                      coords
                        ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
                        : "https://share.google/04uyvfpZ2K7bQQxZx"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Turboride Experience Zone
                  </a>{" "}
                  — arrive 15 min early
                </>
              }
            />
          </div>

          {coords && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-border">
                <iframe
                  title="Turboride Experience Zone location map"
                  src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <p className="text-sm font-medium text-foreground">Find us here</p>
                <p className="text-sm text-muted-foreground text-pretty">
                  Tap the map to open it in Google Maps for turn-by-turn directions.
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Get directions
                </a>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border p-4">
            <p className="mb-3 font-display text-sm font-bold text-foreground">Receipt</p>
            <dl className="space-y-2 text-sm">
              {data.price.lines.map((line, i) => (
                <ReceiptRow
                  key={`${line.carId}-${i}`}
                  label={`${line.carName} — ${line.laps} lap${line.laps > 1 ? "s" : ""}`}
                  value={formatINR(line.base)}
                />
              ))}
              {data.price.discount > 0 && (
                <ReceiptRow label="Full-pay discount" value={`− ${formatINR(data.price.discount)}`} />
              )}
              {data.price.addons > 0 && <ReceiptRow label="Add-ons" value={formatINR(data.price.addons)} />}
              <ReceiptRow label={gstLabel(data.price.gst, data.price.subtotal)} value={formatINR(data.price.gst)} />
              <div className="border-t border-border pt-2">
                {payAtVenue ? (
                  <>
                    <ReceiptRow label="Advance paid now" value={formatINR(data.price.payNow)} strong />
                    <ReceiptRow label="Balance at venue" value={formatINR(data.price.balanceAtVenue)} muted />
                    <ReceiptRow label="If paid in full online" value={formatINR(onlineTotal)} muted />
                  </>
                ) : (
                  <ReceiptRow label="Total paid" value={formatINR(data.price.payNow)} strong />
                )}
              </div>
            </dl>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              A receipt and venue instructions are on their way to{" "}
              <span className="font-medium">{data.contact.email}</span>. We&apos;ll also send a reminder 24 hours
              before your slot.
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button nativeButton={false} render={<a href="/login">Manage my booking</a>} className="w-full" />
            <Button
              nativeButton={false}
              render={<a href="/">Book another drive</a>}
              variant="outline"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
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
