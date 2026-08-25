"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Check } from "lucide-react"

/**
 * Client-side urgency widgets for a per-car pre-book landing page.
 *
 * Owns a single `spotsLeft` figure so the countdown card and the social-proof
 * toast always agree. `spotsLeft` starts from a server-computed baseline (~70%
 * of the milestone already taken) and ticks down by one each time a fake
 * "someone just pre-booked" toast fires, reinforcing scarcity.
 *
 * All the social-proof activity is simulated marketing copy — no real data.
 */

const NAMES = [
  "Anand", "Priya", "Rahul", "Sneha", "Vikram", "Arjun", "Kavya", "Rohan",
  "Meera", "Karthik", "Divya", "Aditya", "Neha", "Sanjay", "Pooja", "Nikhil",
  "Ananya", "Varun", "Ishaan", "Tara", "Dhruv", "Riya", "Aryan", "Lakshmi",
]

const ACTIONS = [
  "just completed their pre-booking",
  "just reserved a seat",
  "just locked launch pricing",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

type Toast = { id: number; name: string; action: string; at: number }

export function PrebookUrgency({
  spotsTaken,
  threshold,
}: {
  /** Server-computed baseline of seats already taken (~70% of the milestone). */
  spotsTaken: number
  /** Total pre-launch spots (the admin-set milestone). */
  threshold: number
}) {
  const initialLeft = Math.max(0, threshold - spotsTaken)
  const [spotsLeft, setSpotsLeft] = useState(initialLeft)
  const [toast, setToast] = useState<Toast | null>(null)
  // Once the visitor completes their own pre-booking, we stop the social-proof
  // notifications entirely — nagging someone who already booked adds no value.
  const [stopped, setStopped] = useState(false)
  // Never let the fake counter run dry — keep a healthy-but-shrinking scarcity floor.
  const floor = useMemo(() => Math.max(1, Math.round(threshold * 0.12)), [threshold])
  const nextId = useRef(0)

  // The booking wizard fires this once a booking succeeds (see booking-wizard.tsx).
  useEffect(() => {
    const onBooked = () => {
      setStopped(true)
      setToast(null)
    }
    window.addEventListener("turboride:booked", onBooked)
    return () => window.removeEventListener("turboride:booked", onBooked)
  }, [])

  useEffect(() => {
    if (stopped) return
    let showTimer: ReturnType<typeof setTimeout>

    // Emit a notification now (does NOT decrement the counter — it represents an
    // earlier sign-up), so the area under the card is filled the instant the page
    // loads instead of starting blank and waiting for the first timer.
    const emitInitial = () => {
      nextId.current += 1
      // A slightly older stamp (3–12 min ago) reads like pre-existing activity.
      const minutesAgo = 3 + Math.floor(Math.random() * 10)
      setToast({
        id: nextId.current,
        name: pick(NAMES),
        action: pick(ACTIONS),
        at: Date.now() - minutesAgo * 60000,
      })
    }

    const schedule = () => {
      // Space the notifications out so they feel organic, not spammy: each waits
      // a random 45s–150s — sometimes a quick follow-up, sometimes a long lull.
      const delay = 45000 + Math.random() * 105000
      showTimer = setTimeout(() => {
        setSpotsLeft((prev) => {
          const next = prev > floor ? prev - 1 : prev
          nextId.current += 1
          // Stamp the "sign-up" as having happened a few minutes ago (2–9 min),
          // so the displayed local time reads like a real, slightly-past event.
          const minutesAgo = 2 + Math.floor(Math.random() * 8)
          setToast({
            id: nextId.current,
            name: pick(NAMES),
            action: pick(ACTIONS),
            at: Date.now() - minutesAgo * 60000,
          })
          return next
        })
        schedule()
      }, delay)
    }

    emitInitial()
    schedule()
    return () => clearTimeout(showTimer)
  }, [floor, stopped])

  return (
    <div>
      {/* Live scarcity card — drops into the benefits grid in place of a static perk.
          `filled` is derived from `spotsLeft` so a booking event bumps both counters
          in lockstep (one more filled, one fewer left). */}
      <div className="rounded-xl border border-primary/30 bg-accent p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Flame className="h-5 w-5" />
        </span>
        <p className="mt-3 font-display font-bold text-foreground">Filling up fast</p>
        <dl className="mt-4 space-y-3">
          <StatRow label="Total pre-launch spots" value={threshold} />
          <StatRow label="Spots filled" value={threshold - spotsLeft} />
          <StatRow label="Spots left" value={spotsLeft} />
        </dl>
      </div>

      {/* Inline social-proof note — sits right under the card so the visitor can
          watch the counters above change when someone "reserves" a seat. A fixed
          min-height reserves the space so the layout doesn't jump when it toggles. */}
      <div aria-live="polite" className="mt-2 min-h-[52px]">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="animate-in fade-in slide-in-from-top-1 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm duration-300"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-muted text-success">
              <Check className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs leading-snug text-foreground text-pretty">
                <span className="font-semibold">{toast.name}</span> {toast.action}.
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{formatClock(toast.at)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Formats a timestamp as a static local wall-clock time (e.g. "6:07 PM"),
 * so the notification reads like a real sign-up that happened minutes ago
 * rather than a counter ticking up second by second.
 */
function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/** A label + flip-clock-style number, used for the live scarcity counters. */
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs leading-tight text-muted-foreground text-pretty">{label}</dt>
      <dd>
        <FlipNumber value={value} />
      </dd>
    </div>
  )
}

/**
 * Renders an integer as split-flap tiles matching the FlipTimer aesthetic.
 * Always 3 digits (zero-padded, e.g. 054) so every row lines up. Each digit
 * lives in its own dark tile; keying the inner span on the digit remounts it
 * when the value changes, replaying the `tr-flip-digit` flip animation.
 */
function FlipNumber({ value }: { value: number }) {
  const digits = String(Math.max(0, value)).padStart(3, "0").split("")
  return (
    <div className="flex gap-0.5">
      <span className="sr-only">{value}</span>
      {digits.map((d, i) => (
        <span
          key={i}
          aria-hidden
          className="relative flex h-9 w-6 items-center justify-center overflow-hidden rounded-md border border-foreground/15 bg-foreground text-base font-display font-extrabold tabular-nums text-background shadow-sm"
        >
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-background/20" />
          <span key={d} className="tr-flip-digit-slow">
            {d}
          </span>
        </span>
      ))}
    </div>
  )
}
