import { DISCOUNT_ONE_LAP, GST_RATE, maxRideAlongLaps, REEL_PRICE, type Car } from "./fleet"

/** How the customer chooses to pay: in full online (discount) or a small advance now with the balance at the venue. */
export type PaymentOption = "full" | "venue"

/**
 * Advance (₹) collected online for the "pay at venue" option. The rest of the
 * (undiscounted) total is settled at the venue on drive day. No discount applies.
 */
export const VENUE_ADVANCE = 1000

/**
 * A single car in the booking lineup: which car, how many laps, and how many of
 * those laps a co-passenger rides along. Multiple lines are driven back-to-back
 * in the same slot.
 */
export type CarLine = {
  car: Car
  laps: number
  /** How many laps the customer wants to bring a co-passenger along (0..laps-1). */
  rideAlongLaps: number
}

export type BookingState = {
  /** The lineup of cars, each with its own laps + ride-along. Driven one after another. */
  cars: CarLine[]
  /** Instagram reels are a single count for the whole session (not per car). */
  reels: number
  payment: PaymentOption
}

/** Full-payment discount rate (fraction), configurable in admin Settings. Applies to any full online payment. */
export type DiscountRates = {
  discount: number
}

export const DEFAULT_DISCOUNT_RATES: DiscountRates = {
  discount: DISCOUNT_ONE_LAP,
}

/** Per-car itemization within a multi-car booking. */
export type CarLineBreakdown = {
  carId: string
  carName: string
  laps: number
  basePerLap: number
  /** pricePerLap × laps for this car. */
  base: number
  /** Effective co-passenger laps after clamping to 0..laps-1. */
  rideAlongLaps: number
  /** Cost of this car's co-passenger ride-along (₹). */
  rideAlong: number
}

export type PriceBreakdown = {
  /** One entry per car in the lineup, in order. */
  lines: CarLineBreakdown[]
  /** Combined base across all cars (Σ pricePerLap × laps). */
  base: number
  discountRate: number
  discount: number
  /** Cost of the Instagram reel add-ons (₹). */
  reelsCost: number
  /** Combined co-passenger ride-along cost across all cars (₹). */
  rideAlong: number
  /** All add-ons combined (reels + ride-along), the figure GST is charged on with base. */
  addons: number
  subtotal: number
  gst: number
  total: number
  payNow: number
  balanceAtVenue: number
  /** True when the customer opted to pay at the venue (nothing online, no discount). */
  payAtVenue: boolean
}

/**
 * Full pricing engine implementing Turboride's rules for a multi-car lineup:
 * - each car: base = pricePerLap × laps, plus co-passenger ride-along (laps-1 max × pricePerRideAlongLap)
 * - base = Σ every car's base; add-ons = reels × ₹1,500 + Σ every car's ride-along
 * - full-payment discount: a single rate configurable in admin Settings, applied to any full online payment
 * - 18% GST on the discounted subtotal (base - discount + add-ons)
 * - pay-at-venue option: a fixed ₹1,000 advance online, no discount, the balance settled at the venue
 */
export function calculatePrice(
  state: BookingState,
  rates: DiscountRates = DEFAULT_DISCOUNT_RATES,
  reelPrice: number = REEL_PRICE,
  gstRate: number = GST_RATE,
): PriceBreakdown {
  // Itemize each car. Ride-along is clamped defensively (lap 1 is always solo with the
  // instructor) so an out-of-range client value can never inflate the price.
  const lines: CarLineBreakdown[] = state.cars.map((line) => {
    const basePerLap = line.car.pricePerLap ?? 0
    const laps = Math.max(0, Math.floor(line.laps || 0))
    const base = basePerLap * laps
    const rideAlongPrice = line.car.pricePerRideAlongLap ?? 0
    const rideAlongLaps = Math.min(Math.max(0, Math.floor(line.rideAlongLaps || 0)), maxRideAlongLaps(laps))
    return {
      carId: line.car.id,
      carName: line.car.name,
      laps,
      basePerLap,
      base,
      rideAlongLaps,
      rideAlong: rideAlongLaps * rideAlongPrice,
    }
  })

  const base = lines.reduce((sum, l) => sum + l.base, 0)
  const rideAlong = lines.reduce((sum, l) => sum + l.rideAlong, 0)
  const reelsCost = state.reels * reelPrice

  const addons = reelsCost + rideAlong
  const payAtVenue = state.payment === "venue"

  // The launch discount is only granted when paying in full online.
  const discountRate = payAtVenue ? 0 : rates.discount
  const discount = Math.round(base * discountRate)

  const subtotal = base - discount + addons
  const gst = Math.round(subtotal * gstRate)
  const total = subtotal + gst

  // Pay-at-venue: a fixed ₹1,000 advance is collected online now (no discount); the
  // remaining undiscounted total is settled at the venue. Clamp the advance so a tiny
  // total can never produce a negative balance.
  const payNow = payAtVenue ? Math.min(VENUE_ADVANCE, total) : total
  const balanceAtVenue = payAtVenue ? total - payNow : 0

  return {
    lines,
    base,
    discountRate,
    discount,
    reelsCost,
    rideAlong,
    addons,
    subtotal,
    gst,
    total,
    payNow,
    balanceAtVenue,
    payAtVenue,
  }
}

/**
 * All-inclusive discounted total from raw base/add-on figures, e.g. when re-pricing a
 * saved booking so a customer can settle the balance online and claim the full-pay
 * discount. Mirrors calculatePrice's full-payment branch (discount applies to base only,
 * GST on the discounted subtotal) so the figure matches what checkout would have charged.
 */
export function discountedFullPayTotal(
  base: number,
  addons: number,
  discountRate: number,
  gstRate: number,
): number {
  const discount = Math.round(base * discountRate)
  const subtotal = base - discount + addons
  return subtotal + Math.round(subtotal * gstRate)
}

/**
 * The all-inclusive total if the customer pays in full online to claim the discount.
 * Mirrors calculatePrice's full-payment branch so the "if paid online" figure stays consistent.
 */
export function fullPayTotal(
  price: PriceBreakdown,
  rates: DiscountRates = DEFAULT_DISCOUNT_RATES,
  gstRate: number = GST_RATE,
): number {
  const discount = Math.round(price.base * rates.discount)
  const subtotal = price.base - discount + price.addons
  return subtotal + Math.round(subtotal * gstRate)
}

/**
 * Percentage shown next to a GST line, derived from the actual amounts so it stays
 * accurate even on historical receipts booked at an older rate. Falls back to the
 * current default when a subtotal isn't available.
 */
export function gstPercent(gst: number, subtotal: number): number {
  return subtotal > 0 ? Math.round((gst / subtotal) * 100) : Math.round(GST_RATE * 100)
}

/** Convenience label, e.g. "GST (18%)". */
export function gstLabel(gst: number, subtotal: number): string {
  return `GST (${gstPercent(gst, subtotal)}%)`
}
