"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { TIME_SLOTS } from "@/lib/turboride/fleet"
import type { PublicAvailability } from "@/lib/turboride/schedule"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { useState } from "react"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function DateTimeStep({
  date,
  slot,
  onDateChange,
  onSlotChange,
  availability,
  maxDate,
  minLeadDays = 1,
}: {
  date: string | null
  slot: string | null
  onDateChange: (date: string) => void
  onSlotChange: (slot: string) => void
  availability?: PublicAvailability
  /** Latest selectable day as `YYYY-MM-DD` (e.g. a booking's validity deadline). */
  maxDate?: string | null
  /** Minimum lead time in days: 0 allows same-day, 1 makes tomorrow the earliest, etc. */
  minLeadDays?: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minDate = new Date(today)
  minDate.setDate(minDate.getDate() + Math.max(0, Math.floor(minLeadDays)))

  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  // Slots come from admin config when provided, else fall back to code defaults.
  const slots = availability?.slots ?? TIME_SLOTS.map((s) => ({ slot: s, capacity: 2 }))
  const blackouts = availability?.blackouts ?? []
  const booked = availability?.booked ?? {}

  const isBlackout = useMemo(
    () => (key: string) => blackouts.some((b) => key >= b.startDate && key <= b.endDate),
    [blackouts],
  )

  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const canGoBack = new Date(year, month, 1) > new Date(today.getFullYear(), today.getMonth(), 1)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-bold text-foreground">
            {MONTHS[month]} {year}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!canGoBack}
              onClick={() => setView(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setView(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-xs font-semibold text-muted-foreground">
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} />
            const key = ymd(cell)
            const blocked = isBlackout(key)
            const beyondMax = !!maxDate && key > maxDate
            const disabled = cell < minDate || blocked || beyondMax
            const selected = date === key
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onDateChange(key)}
                title={blocked ? "Unavailable (no drives this day)" : undefined}
                className={`relative flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : blocked
                      ? "cursor-not-allowed text-muted-foreground/40 line-through"
                      : disabled
                        ? "cursor-not-allowed text-muted-foreground/40"
                        : "text-foreground hover:bg-accent"
                }`}
              >
                {cell.getDate()}
              </button>
            )
          })}
        </div>
        {blackouts.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Struck-through dates are closed for maintenance or private events.
          </p>
        )}
      </div>

      <div className="lg:w-56">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="h-4 w-4 text-primary" /> Select a time slot
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {slots.map(({ slot: s, capacity }) => {
            const selected = slot === s
            const takenCount = date ? (booked[`${date}__${s}`] ?? 0) : 0
            const soldOut = !!date && takenCount >= capacity
            const remaining = Math.max(0, capacity - takenCount)
            return (
              <button
                key={s}
                type="button"
                disabled={!date || soldOut}
                onClick={() => onSlotChange(s)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : soldOut
                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground/50"
                      : "border-border bg-card text-foreground hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                }`}
              >
                <span>{s}</span>
                {date && !selected && (
                  <span className={`text-xs ${soldOut ? "text-destructive" : "text-muted-foreground"}`}>
                    {soldOut ? "Sold out" : `${remaining} left`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {!date && (
          <p className="mt-2 text-xs text-muted-foreground">Pick a date to unlock slots.</p>
        )}
      </div>
    </div>
  )
}
