"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cars, type Car } from "./cars"

const spring = { type: "spring" as const, stiffness: 180, damping: 28, mass: 0.9 }
const WINDOW = 3 // slides rendered on each side of the active one

const wrap = (i: number) => ((i % cars.length) + cars.length) % cars.length

export function CarShowcase() {
  // Unbounded "virtual" index — it can go negative or past the last car,
  // which is what makes the loop seamless in both directions.
  const [index, setIndex] = useState(2)
  const [width, setWidth] = useState(1200)
  const stageRef = useRef<HTMLDivElement>(null)
  const pos = useMotionValue(2)

  useEffect(() => {
    const measure = () => setWidth(stageRef.current?.offsetWidth ?? window.innerWidth)
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    const controls = animate(pos, index, spring)
    return () => controls.stop()
  }, [index, pos])

  const go = useCallback((dir: number) => setIndex((i) => i + dir), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1)
      if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.2
    if (power < -80) go(1)
    else if (power > 80) go(-1)
  }

  const activeIndex = wrap(index)
  const car = cars[activeIndex]!
  // Hero car fills more of the viewport on small screens (matching the Porsche
  // reference), then eases back to a wider stage on desktop where neighbours read well.
  const slide = width * (width < 640 ? 0.82 : 0.56)

  // Jump to a dot by the shortest wrapped distance, so the loop never rewinds.
  const goTo = (target: number) => {
    const diff = wrap(target - activeIndex)
    const delta = diff > cars.length / 2 ? diff - cars.length : diff
    setIndex((i) => i + delta)
  }

  const slides = useMemo(
    () => Array.from({ length: WINDOW * 2 + 1 }, (_, k) => index - WINDOW + k),
    [index],
  )

  return (
      <section className="car-studio relative isolate w-full overflow-hidden bg-studio pt-8 pb-10 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-studio-glow" aria-hidden />

      <header className="relative z-20 mx-auto max-w-3xl px-6 text-center">
        <h1 className="font-display text-3xl leading-[1.05] font-extrabold tracking-tight text-foreground sm:text-5xl">
          Get ready to meet icons.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          A sneak peek at the lineup awaiting you.
        </p>
      </header>

      {/* Stage */}
      <div ref={stageRef} className="relative mt-1 h-[54vw] max-h-[440px] min-h-[210px] w-full sm:mt-14 sm:h-[46vw]">
        {/* Watermark — sits behind the car; lifted higher on wider screens so it
            peeks above the roofline instead of being swallowed by the car. */}
        <div className="pointer-events-none absolute inset-x-0 top-[-16%] z-0 flex justify-center sm:top-[-30%]">
          <AnimatePresence mode="wait">
            <motion.span
              key={car.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5 }}
              className={
                car.watermarkStyle === "script"
                  ? "font-script text-watermark opacity-25 text-[15vw] leading-none whitespace-nowrap sm:text-[12vw]"
                  : "font-display text-watermark opacity-25 text-[15vw] leading-none font-extrabold tracking-tight whitespace-nowrap sm:text-[12vw]"
              }
            >
              {car.watermark}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Floor */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[38%] bg-tarmac" aria-hidden />

        {/* Track — draggable shell; slides are positioned from the motion value */}
        <motion.div
          className="absolute inset-x-0 top-0 bottom-[16%] z-10 cursor-grab active:cursor-grabbing"
          drag="x"
          dragElastic={0.35}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
          style={{ touchAction: "pan-y" }}
        >
          {slides.map((vIdx) => (
            <Slide
              key={vIdx}
              car={cars[wrap(vIdx)]!}
              vIdx={vIdx}
              pos={pos}
              slide={slide}
              width={width}
              eager={wrap(vIdx) === 2}
            />
          ))}
        </motion.div>

        {/* Arrows — hidden on mobile (swipe + dots handle navigation there) */}
        <div className="absolute inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 justify-between px-2 sm:flex sm:px-6">
          <ArrowButton dir="left" onClick={() => go(-1)} />
          <ArrowButton dir="right" onClick={() => go(1)} />
        </div>
      </div>

      {/* Specs bar */}
      <div className="relative z-20 mx-auto mt-6 max-w-6xl px-6 sm:mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={car.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start"
          >
            <div className="min-w-0 text-center md:text-left">
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {car.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <p className="font-display text-lg font-bold text-foreground">
                  {car.price}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">/ lap</span>
                </p>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    car.status === "available"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-border bg-white/5 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      car.status === "available" ? "bg-emerald-400" : "bg-muted-foreground"
                    }`}
                  />
                  {car.status === "available" ? "Available Now" : "Coming Soon"}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
              <Metric value={car.acceleration} unit="s" caption="Acceleration 0-100 km/h" />
              <Metric value={car.power} caption="Maximum power output" className="sm:px-6" />
              <Metric value={car.topSpeed} unit="km/h" caption="Top speed" className="sm:pl-6" />
            </dl>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="mt-8 flex justify-center gap-2">
          {cars.map((c, i) => (
            <button
              key={c.id}
              aria-label={`Show ${c.name}`}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all ${
                i === activeIndex ? "w-8 bg-foreground" : "w-4 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Slide({
  car,
  vIdx,
  pos,
  slide,
  width,
  eager,
}: {
  car: Car
  vIdx: number
  pos: MotionValue<number>
  slide: number
  width: number
  eager: boolean
}) {
  const offset = useTransform(pos, (p) => vIdx - p)
  const x = useTransform(offset, (o) => width / 2 - slide / 2 + o * slide)
  const opacity = useTransform(offset, [-1, -0.2, 0, 0.2, 1], [0.32, 1, 1, 1, 0.32])
  const scale = useTransform(offset, [-1, 0, 1], [0.88, 1, 0.88])
  const brightness = useTransform(offset, [-1, -0.2, 0, 0.2, 1], [0.55, 1, 1, 1, 0.55])
  const filter = useTransform(brightness, (b) => `brightness(${b})`)

  return (
    <motion.div
      className="absolute bottom-0 left-0 select-none px-[1%]"
      style={{ width: slide, x, opacity, scale, filter }}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={car.image || "/placeholder.svg"}
          alt={`${car.brand} ${car.name} side profile`}
          width={1920}
          height={768}
          draggable={false}
          loading={eager ? "eager" : "lazy"}
          className="w-full drop-shadow-[0_28px_28px_rgba(0,0,0,0.65)]"
        />
        <div className="absolute inset-x-[8%] bottom-[1%] h-[6%] rounded-[50%] bg-black/70 blur-lg" />
      </div>
    </motion.div>
  )
}

function Metric({
  value,
  unit,
  caption,
  className = "",
}: {
  value: string
  unit?: string
  caption: string
  className?: string
}) {
  const parts = value.split(/(\([^)]*\))/g)
  return (
    <div className={`min-w-0 text-center ${className}`}>
      <dd className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        {parts.map((p, i) =>
          p.startsWith("(") ? (
            <span key={i} className="text-sm font-semibold text-muted-foreground">
              {p.replace(/[()]/g, (m) => (m === "(" ? "[" : "]"))}
            </span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
        {unit ? <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span> : null}
      </dd>
      <dt className="mx-auto mt-2 max-w-[16rem] text-[11px] leading-snug text-muted-foreground">{caption}</dt>
    </div>
  )
}

function ArrowButton({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous model" : "Next model"}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card/40 text-foreground backdrop-blur transition-all hover:bg-card"
    >
      <Icon size={20} strokeWidth={1.5} />
    </button>
  )
}
