"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react"
import { findCar, formatINR, GST_RATE, REEL_PRICE, type Car } from "@/lib/turboride/fleet"
import {
  calculatePrice,
  DEFAULT_DISCOUNT_RATES,
  type CarLine,
  type DiscountRates,
  type PaymentOption,
} from "@/lib/turboride/pricing"
import { createBooking } from "@/app/actions/booking"
import type { PublicAvailability } from "@/lib/turboride/schedule"
import { EligibilityStep, type Eligibility } from "./eligibility-step"
import { LineupStep, type LineDraft } from "./lineup-step"
import { AddonsStep } from "./addons-step"
import { DateTimeStep } from "./datetime-step"
import { CheckoutStep, type Contact } from "./checkout-step"
import { OrderSummary } from "./order-summary"
import { BookingConfirmation, type ConfirmationData } from "./booking-confirmation"

type StepKey = "eligibility" | "lineup" | "addons" | "datetime" | "checkout"

const STEP_META: Record<StepKey, { label: string; title: string; sub: string }> = {
  eligibility: {
    label: "Eligibility",
    title: "Are you eligible to drive?",
    sub: "Confirm the essentials before you hit the highway.",
  },
  lineup: {
    label: "Cars & laps",
    title: "Build your session",
    sub: "Pick your supercars and laps — add more to drive back-to-back in one slot.",
  },
  addons: { label: "Add-ons", title: "Add-ons", sub: "Capture the moment and flex the run." },
  datetime: { label: "Date & Time", title: "Choose date & time", sub: "Reserve a slot that works for you." },
  checkout: { label: "Checkout", title: "Checkout", sub: "Your details and how you'd like to pay." },
}

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const phoneValid = (p: string) => p.replace(/\D/g, "").length >= 10

export function BookingWizard({
  fleet,
  availability,
  bookingsPaused = false,
  lockedCar = null,
  lapDistanceKm = 15,
  lapOptions,
  minLeadDays = 1,
  discountRates = DEFAULT_DISCOUNT_RATES,
  reelPrice = REEL_PRICE,
  gstRate = GST_RATE,
  locationCoords,
  contactPrefill = null,
}: {
  fleet: Car[]
  availability?: PublicAvailability
  bookingsPaused?: boolean
  /**
   * When set (e.g. a per-car landing page), the wizard is pre-focused on this car
   * and the car-selection step is skipped.
   */
  lockedCar?: Car | null
  /** Distance per lap in km (from admin Settings). */
  lapDistanceKm?: number
  /** Lap counts to offer in the lineup step (from admin Settings). */
  lapOptions?: number[]
  /** Minimum booking lead time in days (from admin Settings). 0 = same-day allowed. */
  minLeadDays?: number
  /** Full-pay discount rates (from admin Settings). */
  discountRates?: DiscountRates
  /** Price per Instagram reel add-on (from admin Settings). */
  reelPrice?: number
  /** GST rate as a fraction (from admin Settings). */
  gstRate?: number
  /** Venue coordinates "lat, lng" (from admin Settings) — powers the confirmation map. */
  locationCoords?: string
  /** Saved contact details for a signed-in returning customer, used to pre-fill checkout. */
  contactPrefill?: Contact | null
}) {
  const [step, setStep] = useState(0)
  const [eligibility, setEligibility] = useState<Eligibility>({
    age: false,
    license: false,
    automatic: false,
  })
  // The lineup of cars, each with its own laps + co-passenger ride-along. Pre-seeded
  // with the locked car on a per-car landing page.
  const [lines, setLines] = useState<LineDraft[]>(
    lockedCar ? [{ id: lockedCar.id, laps: 1, rideAlongLaps: 0 }] : [],
  )
  const [reels, setReels] = useState(0)
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [contact, setContact] = useState<Contact>(
    contactPrefill ?? { name: "", email: "", phone: "" },
  )
  const [payment, setPayment] = useState<PaymentOption>("full")
  const [processing, setProcessing] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)

  // On step change, bring the top of the wizard back into view so each new step
  // starts cleanly at the "Step X of 5" header (mobile users were left mid-scroll).
  const topRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [step])

  // Resolve each draft line to a full Car for pricing (dropping any that no longer exist).
  const carLines = useMemo<CarLine[]>(
    () =>
      lines
        .map((l) => {
          const c = findCar(fleet, l.id)
          return c ? { car: c, laps: l.laps, rideAlongLaps: l.rideAlongLaps } : null
        })
        .filter((x): x is CarLine => x !== null),
    [lines, fleet],
  )
  const firstCar = carLines[0]?.car ?? null

  const price = useMemo(
    () => calculatePrice({ cars: carLines, reels, payment }, discountRates, reelPrice, gstRate),
    [carLines, reels, payment, discountRates, reelPrice, gstRate],
  )

  const stepKeys = useMemo<StepKey[]>(
    () => ["eligibility", "lineup", "addons", "datetime", "checkout"],
    [],
  )

  const currentKey = stepKeys[Math.min(step, stepKeys.length - 1)]
  const eligible = eligibility.age && eligibility.license && eligibility.automatic

  function keyValid(key: StepKey): boolean {
    switch (key) {
      case "eligibility":
        return eligible
      case "lineup":
        return carLines.length > 0
      case "addons":
        return true
      case "datetime":
        return !!date && !!slot
      case "checkout":
        return contact.name.trim().length > 1 && emailValid(contact.email) && phoneValid(contact.phone)
      default:
        return false
    }
  }

  const canProceed = keyValid(currentKey)
  const isLast = step === stepKeys.length - 1

  function next() {
    if (!canProceed) return
    setStep((s) => Math.min(stepKeys.length - 1, s + 1))
  }
  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function handlePay() {
    if (carLines.length === 0 || !canProceed) return
    if (bookingsPaused) {
      toast.error("Bookings are temporarily paused. Please check back soon.")
      return
    }
    setProcessing(true)
    try {
      const result = await createBooking({
        cars: carLines.map((l) => ({ carId: l.car.id, laps: l.laps, rideAlongLaps: l.rideAlongLaps })),
        reels,
        date,
        slot,
        payment,
        contact,
      })
      if (!result.ok) {
        // Show the real reason (sold-out slot, blackout date, paused bookings…).
        toast.error(result.error)
        return
      }
      // Real gateway active: hand off to the hosted checkout. The booking is currently
      // pending; the gateway will return the customer to /book/callback to settle it.
      if (!result.simulated && result.redirectUrl) {
        toast.info("Redirecting to secure payment…")
        window.location.href = result.redirectUrl
        return
      }
      setConfirmation({
        reference: result.reference,
        cars: carLines,
        date,
        slot,
        payment,
        price,
        contact,
      })
      // The booking is done — silence the page's live social-proof notifications.
      if (typeof window !== "undefined") window.dispatchEvent(new Event("turboride:booked"))
      toast.success(
        payment === "venue"
          ? `Advance of ${formatINR(price.payNow)} received — pay the balance at the venue on drive day.`
          : "Payment successful — your highway drive slot is locked in.",
      )
    } catch (e) {
      console.error("[v0] handlePay failed:", e)
      toast.error("We couldn't reach the booking server. Please check your connection and try again.")
    } finally {
      setProcessing(false)
    }
  }

  if (confirmation) {
    return <BookingConfirmation data={confirmation} locationCoords={locationCoords} />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div ref={topRef} className="min-w-0 scroll-mt-24">
        <Stepper stepKeys={stepKeys} step={step} onJump={(s) => s < step && setStep(s)} />

        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
          <StepHeader stepKeys={stepKeys} step={step} eligible={eligible} />

          <div className="mt-5">
            {currentKey === "eligibility" && <EligibilityStep value={eligibility} onChange={setEligibility} />}
            {currentKey === "lineup" && (
              <LineupStep
          fleet={fleet}
          lines={lines}
          onChange={setLines}
          lapDistanceKm={lapDistanceKm}
          lapOptions={lapOptions}
        />
            )}
            {currentKey === "addons" && (
              <AddonsStep reels={reels} onChange={setReels} reelPrice={reelPrice} />
            )}
            {currentKey === "datetime" && (
              <DateTimeStep
                date={date}
                slot={slot}
                onDateChange={setDate}
                onSlotChange={setSlot}
                availability={availability}
                minLeadDays={minLeadDays}
              />
            )}
            {currentKey === "checkout" && firstCar && (
              <CheckoutStep
                contact={contact}
                onContactChange={setContact}
                payment={payment}
                onPaymentChange={setPayment}
                price={price}
                car={firstCar}
              />
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || processing}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {isLast ? (
              <Button
                type="button"
                onClick={handlePay}
                disabled={!canProceed || processing || bookingsPaused}
                className="min-w-44"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : bookingsPaused ? (
                  <>Bookings paused</>
                ) : payment === "venue" ? (
                  <>Pay {formatINR(price.payNow)} advance</>
                ) : (
                  <>Pay {formatINR(price.payNow)}</>
                )}
              </Button>
            ) : (
              <Button type="button" onClick={next} disabled={!canProceed}>
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <OrderSummary
          cars={carLines}
          reels={reels}
          date={date}
          slot={slot}
          price={price}
          lapDistanceKm={lapDistanceKm}
        />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout · Simulated payment demo
        </p>
      </aside>
    </div>
  )
}

function Stepper({
  stepKeys,
  step,
  onJump,
}: {
  stepKeys: StepKey[]
  step: number
  onJump: (s: number) => void
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {stepKeys.map((key, i) => {
        const done = i < step
        const active = i === step
        return (
          <li key={key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={i >= step}
              className={`flex items-center gap-2 rounded-full px-2.5 py-1 text-sm transition-colors ${
                active
                  ? "text-foreground"
                  : done
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/60"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-success text-success-foreground"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden font-medium sm:inline">{STEP_META[key].label}</span>
            </button>
            {i < stepKeys.length - 1 && <span className="h-px w-3 bg-border sm:w-5" />}
          </li>
        )
      })}
    </ol>
  )
}

function StepHeader({
  stepKeys,
  step,
  eligible,
}: {
  stepKeys: StepKey[]
  step: number
  eligible: boolean
}) {
  const key = stepKeys[Math.min(step, stepKeys.length - 1)]
  const meta = STEP_META[key]
  const sub = meta.sub
  const locked = step > 0 && !eligible
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Step {step + 1} of {stepKeys.length}
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-foreground text-balance">
          {meta.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {locked && (
        <span className="flex items-center gap-1 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-medium text-warning-foreground">
          <Lock className="h-3 w-3" /> Locked
        </span>
      )}
    </div>
  )
}
