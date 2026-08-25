"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { formatINR, type Car } from "@/lib/turboride/fleet"
import { Check, ChevronLeft, ChevronRight, Gift, Lock, Wrench, Zap } from "lucide-react"

/** Shortest circular offset between a card index and the active index (looping carousel). */
function circularOffset(index: number, active: number, n: number): number {
  let offset = index - active
  if (offset > n / 2) offset -= n
  if (offset < -n / 2) offset += n
  return offset
}

export function CarStep({
  fleet,
  selectedId,
  onSelect,
}: {
  fleet: Car[]
  selectedId: string | null
  onSelect: (car: Car) => void
}) {
  const N = fleet.length
  const [active, setActive] = useState(() => {
    const i = fleet.findIndex((c) => c.id === selectedId)
    return i >= 0 ? i : 0
  })
  const touchStartX = useRef<number | null>(null)
  // Which coming-soon card was tapped — shows an inline callout inside that card.
  const [blockedId, setBlockedId] = useState<string | null>(null)

  const go = useCallback(
    (dir: 1 | -1) => {
      setBlockedId(null)
      setActive((a) => (a + dir + N) % N)
    },
    [N],
  )

  // Keyboard navigation when the carousel region is focused.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(-1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      go(1)
    }
  }

  useEffect(() => {
    // Keep the active card in sync if selection is cleared/changed externally.
    const i = fleet.findIndex((c) => c.id === selectedId)
    if (i >= 0 && i !== active) setActive(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    // Dismiss the coming-soon callout whenever the browsed card changes.
    setBlockedId(null)
  }, [active])

  const activeCar = fleet[active]

  return (
    <div className="flex flex-col items-center">
      <div
        role="group"
        aria-label="Choose your supercar"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const delta = e.changedTouches[0].clientX - touchStartX.current
          if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1)
          touchStartX.current = null
        }}
        className="relative h-[420px] w-full select-none outline-none [perspective:1600px] sm:h-[440px]"
        style={{ touchAction: "pan-y" }}
      >
        {fleet.map((car, index) => {
          const offset = circularOffset(index, active, N)
          const abs = Math.abs(offset)
          const isCenter = offset === 0
          const selected = car.id === selectedId
          // Only `available` cars are bookable; both `comingsoon` and `paused` are blocked
          // from selection but carry different badges/messaging.
          const bookable = car.status === "available"
          const paused = car.status === "paused"
          const blocked = blockedId === car.id
          const hidden = abs > 2

          const translate = offset * 58 // percent
          const scale = isCenter ? 1 : abs === 1 ? 0.85 : 0.72
          const blur = isCenter ? 0 : abs === 1 ? 1.5 : 3
          const opacity = hidden ? 0 : isCenter ? 1 : abs === 1 ? 0.65 : 0.32
          const z = 30 - abs * 10

          return (
            <div
              key={car.id}
              className="absolute left-1/2 top-0 w-[min(90vw,400px)] transition-all duration-500 ease-out"
              style={{
                transform: `translateX(-50%) translateX(${translate}%) scale(${scale})`,
                filter: blur ? `blur(${blur}px)` : undefined,
                opacity,
                zIndex: z,
                pointerEvents: hidden ? "none" : "auto",
              }}
              aria-hidden={hidden}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isCenter) {
                    setActive(index)
                  } else if (!bookable) {
                    // Not bookable (coming soon or paused) — show the inline callout instead of selecting.
                    setBlockedId(car.id)
                  } else {
                    onSelect(car)
                  }
                }}
                aria-pressed={selected}
                aria-label={
                  !bookable
                    ? `${car.name} — ${paused ? "temporarily unavailable" : "coming soon"}`
                    : isCenter
                      ? `Select ${car.name}`
                      : `View ${car.name}`
                }
                tabIndex={isCenter ? 0 : -1}
                className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left transition-all ${
                  selected
                    ? "border-primary ring-2 ring-primary/40 shadow-xl shadow-primary/10"
                    : isCenter
                      ? "border-border shadow-2xl shadow-foreground/10"
                      : "border-border shadow-md"
                }`}
              >
                {selected && (
                  <span className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}

                {/* Seamless image stage — scaled up to crop empty margins, full profile stays visible */}
                <div className="relative h-44 w-full overflow-hidden bg-card px-2">
                  <Image
                    src={car.image || "/placeholder.svg"}
                    alt={car.name}
                    fill
                    sizes="(max-width: 640px) 90vw, 400px"
                    className={`scale-[1.55] object-contain transition ${
                      !bookable ? "opacity-60 saturate-[0.85]" : ""
                    }`}
                    priority={isCenter}
                  />
                  <div className="absolute left-4 top-4">
                    {bookable ? (
                      <Badge className="gap-1 border-success/30 bg-success-muted text-success">
                        <Zap className="h-3 w-3" /> Available Now
                      </Badge>
                    ) : paused ? (
                      <Badge className="gap-1 border-warning/40 bg-warning-muted text-warning-foreground">
                        <Wrench className="h-3 w-3" /> Temporarily Unavailable
                      </Badge>
                    ) : (
                      <Badge className="gap-1 border-border bg-secondary text-muted-foreground">
                        <Lock className="h-3 w-3" /> Coming Soon
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {car.brand}
                    </p>
                    <h3 className="font-display text-lg font-bold leading-tight text-foreground">
                      {car.name}
                    </h3>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="text-xl font-bold text-foreground">{formatINR(car.pricePerLap)}</span>
                    <span className="pb-0.5 text-xs text-muted-foreground">/ lap</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {car.specs.map((s) => (
                      <span
                        key={s.label}
                        className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground"
                      >
                        {s.label} · {s.value}
                      </span>
                    ))}
                  </div>

                  {car.perks && (
                    <ul className="mt-auto space-y-1 border-t border-border pt-3">
                      {car.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-1.5 text-xs text-foreground">
                          <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!bookable && (
                    <div className="mt-auto border-t border-border pt-3">
                      {blocked ? (
                        <p
                          className={`rounded-lg px-3 py-2 text-xs leading-relaxed text-foreground ${
                            paused ? "bg-warning-muted" : "bg-secondary"
                          }`}
                        >
                          <span className="font-semibold">
                            {paused
                              ? "This car is temporarily unavailable."
                              : "This machine joins the fleet soon!"}
                          </span>{" "}
                          Please select an available car to continue.
                        </p>
                      ) : paused ? (
                        <span className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-warning/40 bg-warning-muted/70 px-3 py-2 text-xs font-semibold text-warning-foreground">
                          <Wrench className="h-3.5 w-3.5" /> Temporarily unavailable
                        </span>
                      ) : (
                        <span className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                          <Lock className="h-3.5 w-3.5" /> Coming soon — not yet bookable
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </div>
          )
        })}

        {/* Desktop navigation arrows */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous car"
          className="absolute left-1 top-[88px] z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:border-primary hover:bg-primary hover:text-primary-foreground sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next car"
          className="absolute right-1 top-[88px] z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:border-primary hover:bg-primary hover:text-primary-foreground sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots + helper caption */}
      <div className="mt-2 flex items-center gap-2">
        {fleet.map((car, index) => (
          <button
            key={car.id}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`Go to ${car.name}`}
            className={`h-2 rounded-full transition-all ${
              index === active ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        {selectedId === activeCar.id ? (
          <span className="font-medium text-foreground">{activeCar.name} selected</span>
        ) : activeCar.status === "paused" ? (
          <span className="font-medium text-foreground">{activeCar.name} — temporarily unavailable</span>
        ) : activeCar.status === "comingsoon" ? (
          <span className="font-medium text-foreground">{activeCar.name} — coming soon, not yet bookable</span>
        ) : (
          <>
            Swipe or use the arrows to browse — tap the centered car to select it.
          </>
        )}
      </p>
    </div>
  )
}
