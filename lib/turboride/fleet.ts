/**
 * Car availability states:
 *  - `available`  → bookable on the storefront.
 *  - `comingsoon` → not launched yet (part of the upcoming-fleet / OTO launch story).
 *  - `paused`     → launched but temporarily out (servicing, breakdown); not bookable,
 *                   shown as "Temporarily unavailable" — kept out of the launch narrative.
 */
export type CarStatus = "available" | "comingsoon" | "paused"

export type Car = {
  id: string
  name: string
  brand: string
  image: string
  status: CarStatus
  pricePerLap: number
  /**
   * Price (₹) to bring a co-passenger along for a single lap. Admin-editable per car.
   * 0 (or undefined) means the co-passenger ride-along add-on is not offered for this car.
   */
  pricePerRideAlongLap?: number
  regularPrice?: number
  deposit?: number
  bookingType: string
  specs: { label: string; value: string }[]
  perks?: string[]
  accent: string
  /**
   * Real-world ex-showroom price of the road car (India), as a pre-formatted
   * display string (e.g. "₹3,50,00,000"). Admin-editable per car; shown on the
   * car landing page. Undefined hides the card.
   */
  exShowroom?: string
}

/** Default price per Instagram reel add-on, in ₹. Overridable via admin Settings. */
export const REEL_PRICE = 1500
export const PREBOOK_DEPOSIT = 1000
export const GST_RATE = 0.18
export const PREBOOK_THRESHOLD = 1000
/** Default distance covered per lap, in km. Overridable via admin Settings. */
export const LAP_DISTANCE_KM = 15
/** Default full-payment discount rates (fraction of base). Overridable via admin Settings. */
export const DISCOUNT_ONE_LAP = 0.15
export const DISCOUNT_TWO_LAP = 0.25
/** Default full-fleet OTO bundle price (₹) the customer pays. Overridable via admin Settings. */
export const OTO_BUNDLE_PRICE = 25000
/** Default OTO launch discount, as a percentage (e.g. 75 = 75% off). Overridable via admin Settings. */
export const OTO_DISCOUNT_PCT = 75

/**
 * How long a booking stays valid after it is paid in full. Once this window
 * lapses without the drive being taken, the booking is a no-show — no refund and
 * no further rescheduling.
 */
export const BOOKING_VALIDITY_MONTHS = 3
/**
 * Reschedule fee (₹). The first self-service reschedule is free; every subsequent
 * one costs this much.
 */
export const RESCHEDULE_FEE = 1500

export type BookingValidity = {
  /** Deadline (ISO) by which the drive must be taken; null when not yet fully paid. */
  deadline: string | null
  /** True when the validity window has lapsed (no-show, no refund). */
  expired: boolean
}

/**
 * Derives a booking's validity window from when it was paid in full. Pure and
 * client-safe so both the reschedule server guard and the account UI agree.
 * Returns `{ deadline: null, expired: false }` when the booking isn't fully paid
 * yet (the clock only starts at full payment).
 */
export function computeBookingValidity(
  paidInFullAtISO: string | null | undefined,
  months: number = BOOKING_VALIDITY_MONTHS,
): BookingValidity {
  if (!paidInFullAtISO) return { deadline: null, expired: false }
  const start = new Date(paidInFullAtISO)
  if (Number.isNaN(start.getTime())) return { deadline: null, expired: false }
  const deadline = new Date(start)
  deadline.setMonth(deadline.getMonth() + months)
  return { deadline: deadline.toISOString(), expired: Date.now() > deadline.getTime() }
}

/** The reschedule fee due for the Nth reschedule (0-indexed count of past reschedules). */
export function rescheduleFeeFor(pastRescheduleCount: number, fee: number = RESCHEDULE_FEE): number {
  return pastRescheduleCount >= 1 ? fee : 0
}

/** Fully-derived OTO economics — a consistent set of figures for the whole funnel. */
export type OtoEconomics = {
  /** What the customer pays for the full-fleet bundle (₹). */
  price: number
  /** Launch discount as a percentage (e.g. 75). */
  discountPct: number
  /** The pre-discount "worth", derived so that (listValue − price) / listValue === discountPct. */
  listValue: number
  /** Half payable now (the ₹1,000 deposit counts toward this). */
  paidNow: number
  /** Remaining balance settled when the fleet goes live. */
  balanceAtGoLive: number
}

/**
 * Derives the full-fleet OTO economics from the two admin-editable knobs — the
 * bundle price and the discount percentage. The pre-discount `listValue` is
 * computed from them so the receipt stays internally consistent (the discount
 * amount always equals exactly `discountPct`% of the list value). Client-safe.
 */
export function computeOtoEconomics(
  price: number = OTO_BUNDLE_PRICE,
  discountPct: number = OTO_DISCOUNT_PCT,
): OtoEconomics {
  const p = Math.max(0, Math.round(Number(price) || 0))
  // Clamp to <100 so we never divide by zero when back-solving the list value.
  const d = Math.min(95, Math.max(0, Math.round(Number(discountPct) || 0)))
  const listValue = d > 0 ? Math.round(p / (1 - d / 100)) : p
  const paidNow = Math.round(p / 2)
  return { price: p, discountPct: d, listValue, paidNow, balanceAtGoLive: p - paidNow }
}

/**
 * Seed data — the source of truth now lives in the `cars` table (see lib/turboride/cars.ts).
 * This array is used to seed the DB and as a safe fallback if the DB read ever fails.
 */
export const SEED_FLEET: Car[] = [
  {
    id: "porsche-718",
    name: "Porsche 718 Cayman",
    brand: "Porsche",
    image: "/cars/porsche-side.png",
    status: "available",
    pricePerLap: 10000,
    bookingType: "Direct Booking",
    accent: "oklch(0.55 0.13 250)",
    specs: [
      { label: "0-100", value: "4.7s" },
      { label: "Power", value: "300 hp" },
      { label: "Top Speed", value: "275 km/h" },
    ],
  },
  {
    id: "lambo-huracan",
    name: "Lamborghini Huracan",
    brand: "Lamborghini",
    image: "/cars/lambo-side.png",
    status: "available",
    pricePerLap: 20000,
    bookingType: "Direct Booking",
    accent: "oklch(0.78 0.16 90)",
    specs: [
      { label: "0-100", value: "2.9s" },
      { label: "Power", value: "640 hp" },
      { label: "Top Speed", value: "325 km/h" },
    ],
  },
  {
    id: "ferrari-488",
    name: "Ferrari 488 GTB",
    brand: "Ferrari",
    image: "/cars/ferrari-side.png",
    status: "available",
    pricePerLap: 25000,
    bookingType: "Direct Booking",
    accent: "oklch(0.58 0.22 28)",
    specs: [
      { label: "0-100", value: "3.0s" },
      { label: "Power", value: "661 hp" },
      { label: "Top Speed", value: "330 km/h" },
    ],
  },
  {
    id: "mustang-gt",
    name: "Ford Mustang GT",
    brand: "Ford",
    image: "/cars/mustang-side.png",
    status: "comingsoon",
    pricePerLap: 10000,
    bookingType: "Coming Soon",
    accent: "oklch(0.5 0.13 255)",
    specs: [
      { label: "0-100", value: "4.3s" },
      { label: "Power", value: "460 hp" },
      { label: "Top Speed", value: "250 km/h" },
    ],
  },
  {
    id: "bmw-m4",
    name: "BMW M4 Competition",
    brand: "BMW",
    image: "/cars/bmw-side.png",
    status: "comingsoon",
    pricePerLap: 15000,
    bookingType: "Coming Soon",
    accent: "oklch(0.45 0.05 260)",
    specs: [
      { label: "0-100", value: "3.5s" },
      { label: "Power", value: "503 hp" },
      { label: "Top Speed", value: "290 km/h" },
    ],
  },
  {
    id: "porsche-911-gt3",
    name: "Porsche 911 GT3",
    brand: "Porsche",
    image: "/cars/gt3-side.png",
    status: "comingsoon",
    pricePerLap: 20000,
    bookingType: "Coming Soon",
    accent: "oklch(0.5 0.18 300)",
    specs: [
      { label: "0-100", value: "3.4s" },
      { label: "Power", value: "510 hp" },
      { label: "Top Speed", value: "318 km/h" },
    ],
  },
  {
    id: "mclaren-gt",
    name: "McLaren GT",
    brand: "McLaren",
    image: "/cars/mclaren-side.png",
    status: "comingsoon",
    pricePerLap: 25000,
    bookingType: "Coming Soon",
    accent: "oklch(0.7 0.19 45)",
    specs: [
      { label: "0-100", value: "3.2s" },
      { label: "Power", value: "612 hp" },
      { label: "Top Speed", value: "326 km/h" },
    ],
  },
]

/**
 * The full-fleet one-time-offer (OTO) bundle — the static parts: the cars it
 * unlocks, the go-live window, and the complimentary bonus car. The pricing
 * (price, discount, list value, split payment) is admin-editable and derived at
 * runtime via `computeOtoEconomics` from the values saved in admin Settings.
 * Shared by the OTO sales page, the post-upgrade confirmation, the account
 * portal, and the server-side purchase action.
 */
export const OTO_BUNDLE = {
  goLiveDays: 90,
  bonusCarId: "porsche-718",
  bonusCarName: "Porsche 718 Cayman",
  /**
   * Complimentary VIP perks included with every full-fleet upgrade, redeemed on
   * drive day. Staff MUST provide these — they're surfaced in the member portal
   * and the admin booking details so the venue knows to deliver them. (The free
   * Porsche laps are handled separately as their own bonus booking.)
   */
  perks: [
    { label: "1 free Instagram reel of your drive", detail: "Filmed & edited by our team, share-ready." },
    { label: "1 free companion pass", detail: "Bring a co-passenger along for a ride." },
  ],
  cars: [
    { name: "Ford Mustang GT", value: 10000, image: "/cars/mustang-side.png" },
    { name: "Porsche 911", value: 20000, image: "/cars/gt3-side.png" },
    { name: "Lamborghini Huracán", value: 20000, image: "/cars/lambo-side.png" },
    { name: "Ferrari 488 GTB", value: 25000, image: "/cars/ferrari-side.png" },
    { name: "McLaren GT", value: 25000, image: "/cars/mclaren-side.png" },
  ],
} as const

export const TIME_SLOTS = [
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
]

/**
 * Lap allocation for the full-fleet bundle: each of the 5 cars gets a set of
 * short laps (NOT the standard long lap). Shown on drive day so staff know how
 * many laps to give per car.
 */
export const BUNDLE_LAPS_PER_CAR = 3
export const BUNDLE_LAP_KM = 1
/** Complimentary Porsche 718 lap allocation — short laps, deliberately not the standard long lap. */
export const BONUS_LAPS = 3
export const BONUS_LAP_KM = 1

/**
 * Human-readable "laps to give on drive day" for a booking, disambiguating the
 * three cases so staff never confuse a short bundle/bonus lap with the standard
 * long lap:
 *  - bonus free Porsche  → "3 laps · 1 km per lap"
 *  - full-fleet bundle   → "3 laps × 1 km per car · all 5 cars"
 *  - regular single car  → "{laps} laps · {lapDistanceKm} km per lap"
 * Client-safe.
 */
export function describeLaps(opts: {
  isBonus?: boolean
  otoPurchased?: boolean
  laps: number
  lapDistanceKm: number
}): string {
  if (opts.isBonus) return `${BONUS_LAPS} laps · ${BONUS_LAP_KM} km per lap`
  if (opts.otoPurchased) return `${BUNDLE_LAPS_PER_CAR} laps × ${BUNDLE_LAP_KM} km per car · all 5 cars`
  const n = opts.laps
  return `${n} lap${n === 1 ? "" : "s"} · ${opts.lapDistanceKm} km per lap`
}

/**
 * Maximum number of laps a co-passenger may ride along. Lap 1 is always driven solo
 * with the safety instructor, so a friend can join on any lap after the first —
 * i.e. up to `laps - 1`. Client-safe.
 */
export function maxRideAlongLaps(laps: number): number {
  return Math.max(0, Math.floor(laps || 0) - 1)
}

/** Pure lookup over a fleet array (client-safe). For DB reads use getCarById in cars.ts. */
export function findCar(fleet: Car[], id: string | null): Car | undefined {
  if (!id) return undefined
  return fleet.find((c) => c.id === id)
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}
