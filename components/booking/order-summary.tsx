"use client"

import Image from "next/image"
import { formatINR } from "@/lib/turboride/fleet"
import { gstLabel, type CarLine, type PriceBreakdown } from "@/lib/turboride/pricing"

function Row({
  label,
  value,
  muted,
  accent,
}: {
  label: React.ReactNode
  value: React.ReactNode
  muted?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      <span
        className={`tabular-nums ${accent ? "font-semibold text-success" : muted ? "text-muted-foreground" : "font-medium text-foreground"}`}
      >
        {value}
      </span>
    </div>
  )
}

export function OrderSummary({
  cars,
  reels,
  date,
  slot,
  price,
  lapDistanceKm = 15,
}: {
  cars: CarLine[]
  reels: number
  date: string | null
  slot: string | null
  price: PriceBreakdown
  /** Distance per lap in km (from admin Settings). */
  lapDistanceKm?: number
}) {
  if (cars.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Add a car to build your order summary.
      </div>
    )
  }

  const prettyDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="divide-y divide-border border-b border-border">
        {cars.map((line, i) => (
          <div key={`${line.car.id}-${i}`} className="flex items-center gap-3 p-4">
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
              <Image
                src={line.car.image || "/placeholder.svg"}
                alt={line.car.name}
                fill
                className="object-contain p-1"
                sizes="80px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-foreground">{line.car.name}</p>
              <p className="text-xs text-muted-foreground">
                {line.laps} lap{line.laps > 1 ? "s" : ""} · {line.laps * lapDistanceKm} km
                {line.rideAlongLaps > 0 ? ` · +${line.rideAlongLaps} co-passenger` : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
              {formatINR(line.car.pricePerLap * line.laps)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 p-4">
        <Row
          label={cars.length > 1 ? `Cars subtotal (${cars.length})` : "Base"}
          value={formatINR(price.base)}
        />
        {price.discount > 0 && (
          <Row
            label={`Full-pay discount (${Math.round(price.discountRate * 100)}%)`}
            value={`− ${formatINR(price.discount)}`}
            accent
          />
        )}
        <Row label="10 drive photos" value="Free" muted />
        {reels > 0 && <Row label={`Instagram reel × ${reels}`} value={formatINR(price.reelsCost)} />}
        {price.rideAlong > 0 && <Row label="Co-passenger ride-along" value={formatINR(price.rideAlong)} />}
        <Row label={gstLabel(price.gst, price.subtotal)} value={formatINR(price.gst)} muted />

        <div className="my-1 border-t border-border" />

        {price.payAtVenue ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-foreground">Advance payable now</span>
              <span className="font-display text-lg font-extrabold tabular-nums text-primary">
                {formatINR(price.payNow)}
              </span>
            </div>
            <Row label="Balance at venue" value={formatINR(price.balanceAtVenue)} muted />
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold text-foreground">Total payable</span>
            <span className="font-display text-lg font-extrabold tabular-nums text-primary">
              {formatINR(price.total)}
            </span>
          </div>
        )}

        {(prettyDate || slot) && (
          <p className="pt-1 text-xs text-muted-foreground">
            {prettyDate}
            {prettyDate && slot ? " · " : ""}
            {slot}
          </p>
        )}
      </div>
    </div>
  )
}
