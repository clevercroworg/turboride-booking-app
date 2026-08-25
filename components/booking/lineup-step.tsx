"use client"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatINR, maxRideAlongLaps, type Car } from "@/lib/turboride/fleet"
import { Gauge, Minus, Plus, PlusCircle, ShieldCheck, Users, X } from "lucide-react"
import { CarStep } from "./car-step"

/** Smallest lap count, used as a fallback default for a newly added car. */
export const MIN_LAPS = 1
/** Fallback lap options if admin Settings hasn't configured any (1–10). */
const DEFAULT_LAP_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

/** A single car the customer has added to their session (client draft state). */
export type LineDraft = { id: string; laps: number; rideAlongLaps: number }

export function LineupStep({
  fleet,
  lines,
  onChange,
  lapDistanceKm = 15,
  lapOptions = DEFAULT_LAP_OPTIONS,
}: {
  fleet: Car[]
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  /** Distance per lap in km (from admin Settings). */
  lapDistanceKm?: number
  /** Lap counts to offer in the per-car laps selector (from admin Settings). */
  lapOptions?: number[]
}) {
  const [adding, setAdding] = useState(false)
  // Fall back to the default range if an empty list somehow slips through.
  const laps = lapOptions.length > 0 ? lapOptions : DEFAULT_LAP_OPTIONS
  const defaultLaps = laps[0] ?? MIN_LAPS

  const addedIds = new Set(lines.map((l) => l.id))
  const available = fleet.filter((c) => c.status === "available" && !addedIds.has(c.id))
  const carById = (id: string) => fleet.find((c) => c.id === id)

  function updateLine(id: string, patch: Partial<LineDraft>) {
    onChange(
      lines.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...patch }
        // Lap 1 is always solo with the instructor, so co-passenger laps can't exceed laps-1.
        next.rideAlongLaps = Math.min(next.rideAlongLaps, maxRideAlongLaps(next.laps))
        return next
      }),
    )
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id))
  }

  function addCar(car: Car) {
    onChange([...lines, { id: car.id, laps: defaultLaps, rideAlongLaps: 0 }])
    setAdding(false)
  }

  return (
    <div className="space-y-4">
      {lines.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No cars yet. Add a supercar to start building your session.
          </p>
        </div>
      )}

      {lines.map((line, index) => {
        const car = carById(line.id)
        if (!car) return null
        const maxRide = maxRideAlongLaps(line.laps)
        const rideOffered = (car.pricePerRideAlongLap ?? 0) > 0
        return (
          <div key={line.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-4">
              <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-md bg-secondary sm:block">
                <Image
                  src={car.image || "/placeholder.svg"}
                  alt={car.name}
                  fill
                  className="scale-[1.4] object-contain"
                  sizes="96px"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Car {index + 1} · {car.brand}
                    </p>
                    <h3 className="truncate font-display text-lg font-bold leading-tight text-foreground">
                      {car.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    aria-label={`Remove ${car.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1.5">
                    <label
                      htmlFor={`laps-${line.id}`}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    >
                      <Gauge className="h-3.5 w-3.5" /> Laps
                    </label>
                    <Select
                      value={String(line.laps)}
                      onValueChange={(v) => updateLine(line.id, { laps: Number(v) })}
                    >
                      <SelectTrigger id={`laps-${line.id}`} className="w-full sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {laps.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} lap{n === 1 ? "" : "s"} · {n * lapDistanceKm} km
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold tabular-nums text-foreground">
                      {formatINR(car.pricePerLap * line.laps)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatINR(car.pricePerLap)} × {line.laps} lap{line.laps === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {rideOffered && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-3 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Users className="h-4.5 w-4.5" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Co-passenger ride-along</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {formatINR(car.pricePerRideAlongLap ?? 0)} / lap · lap 1 is always solo with the instructor.
                  </p>
                </div>
                {maxRide > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateLine(line.id, { rideAlongLaps: Math.max(0, line.rideAlongLaps - 1) })}
                      disabled={line.rideAlongLaps === 0}
                      aria-label={`Remove one co-passenger lap from ${car.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center text-lg font-bold tabular-nums text-foreground">
                      {line.rideAlongLaps}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        updateLine(line.id, { rideAlongLaps: Math.min(maxRide, line.rideAlongLaps + 1) })
                      }
                      disabled={line.rideAlongLaps >= maxRide}
                      aria-label={`Add one co-passenger lap to ${car.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Add 2+ laps to bring a co-passenger.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-sm font-bold text-foreground">Add a car to your session</p>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
          {available.length > 0 ? (
            <CarStep fleet={available} selectedId={null} onSelect={addCar} />
          ) : (
            <p className="rounded-lg bg-secondary px-3 py-6 text-center text-sm text-muted-foreground">
              All available cars are already in your session.
            </p>
          )}
        </div>
      ) : (
        available.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/10"
          >
            <PlusCircle className="h-5 w-5" />
            {lines.length === 0 ? "Add a supercar" : "Add another car — drive them back-to-back in one slot"}
          </button>
        )
      )}
    </div>
  )
}
