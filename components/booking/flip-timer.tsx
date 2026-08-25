"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Big flip-clock countdown showing MM : SS : MS.
 *
 * The centisecond column is deliberately included (and never animated) so the
 * timer *feels* like it's draining fast — animating a value that changes every
 * 10ms would just read as noise.
 *
 * Remaining time is derived from an absolute `deadline` timestamp rather than
 * decremented, so background-tab throttling can't desync the clock.
 */
export function FlipTimer({
  deadline,
  onExpire,
  expired = false,
  compact = false,
}: {
  deadline: number
  onExpire?: () => void
  expired?: boolean
  /** Scaled-down, label-less variant used by the sticky bar. */
  compact?: boolean
}) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))
  const firedRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, deadline - Date.now())
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        onExpireRef.current?.()
        clearInterval(id)
      }
    }, 40)
    return () => clearInterval(id)
  }, [deadline])

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const cents = Math.floor((remaining % 1000) / 10)

  const dead = expired || remaining <= 0
  const mm = String(mins).padStart(2, "0")
  const ss = String(secs).padStart(2, "0")
  const cs = String(cents).padStart(2, "0")

  return (
    <div
      className={`tr-flip-scene flex items-end justify-center ${compact ? "gap-1" : "gap-1.5 sm:gap-2"}`}
      role="timer"
      aria-live="off"
      // The sticky copy mirrors the main timer, so hide it from screen readers.
      aria-hidden={compact || undefined}
      aria-label={dead ? "Offer expired" : `${mins} minutes ${secs} seconds remaining`}
    >
      <Unit label="MIN" digits={mm} dead={dead} compact={compact} />
      <Colon dead={dead} compact={compact} />
      <Unit label="SEC" digits={ss} dead={dead} compact={compact} />
      <Colon dead={dead} compact={compact} />
      {/* Never animated: a value changing every 10ms would just read as noise. */}
      <Unit label="MS" digits={cs} dead={dead} compact={compact} animate={false} />
    </div>
  )
}

function Colon({ dead, compact }: { dead: boolean; compact?: boolean }) {
  return (
    <span
      aria-hidden
      className={`font-display font-extrabold ${
        // Compact has no unit labels beneath it, so no bottom padding to clear them.
        compact ? "pb-0 text-lg" : "pb-6 text-2xl sm:pb-7 sm:text-4xl"
      } ${dead ? "text-muted-foreground" : "text-primary"}`}
    >
      :
    </span>
  )
}

function Unit({
  label,
  digits,
  dead,
  compact,
  animate = true,
}: {
  label: string
  digits: string
  dead: boolean
  compact?: boolean
  animate?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={compact ? "flex gap-0.5" : "flex gap-1"}>
        {digits.split("").map((d, i) => (
          <Tile key={`${label}-${i}`} value={d} dead={dead} compact={compact} animate={animate} />
        ))}
      </div>
      {!compact && (
        <span
          className={`font-mono text-[10px] font-bold tracking-widest ${
            dead ? "text-muted-foreground" : "text-primary/70"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  )
}

function Tile({
  value,
  dead,
  compact,
  animate,
}: {
  value: string
  dead: boolean
  compact?: boolean
  animate: boolean
}) {
  // Every unit — including MS — uses one size so the clock reads as a single block.
  const size = compact
    ? "h-8 w-6 rounded-md text-base"
    : "h-14 w-10 rounded-lg text-3xl sm:h-20 sm:w-14 sm:text-5xl"

  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden border font-display font-extrabold tabular-nums shadow-sm ${size} ${
        dead ? "border-border bg-secondary text-muted-foreground" : "border-foreground/15 bg-foreground text-background"
      }`}
    >
      {/* Hairline down the middle sells the split-flap look */}
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-background/20" />
      {/* Keying on the value remounts the span, replaying the flip animation */}
      <span key={value} className={animate ? "tr-flip-digit" : undefined}>
        {value}
      </span>
    </span>
  )
}
