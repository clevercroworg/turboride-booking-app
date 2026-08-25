import "server-only"
import { pool } from "@/lib/db"
import { DISCOUNT_ONE_LAP, GST_RATE, LAP_DISTANCE_KM, REEL_PRICE } from "@/lib/turboride/fleet"

export type SiteSettings = {
  bookingsPaused: boolean
  maintenanceMessage: string
  /** Distance covered per lap, in km — shown everywhere laps are mentioned. */
  lapDistanceKm: number
  /** Lap counts offered to customers in the booking step (e.g. [1,2,…,10]). Sorted, 1–30. */
  lapOptions: number[]
  /** Minimum booking lead time in days. 0 = allow same-day, 1 = earliest is tomorrow, etc. */
  minLeadDays: number
  /** Universal full-payment discount (fraction of base, e.g. 0.15) applied to any full online payment. */
  discount: number
  /** Price per Instagram reel add-on, in ₹. */
  reelPrice: number
  /** GST rate applied to the subtotal (fraction, e.g. 0.18 for 18%). */
  gstRate: number
  /** Drive location — a Google Maps link shown to customers and available as the {{location}} email tag. */
  location: string
  /** Venue coordinates as "lat, lng" — powers the embedded map on the confirmation page. */
  locationCoords: string
  /** Which payment gateway is active for live checkout. */
  paymentGateway: "phonepe" | "razorpay"
  /**
   * When true, no real gateway is called — bookings settle instantly (used in the v0
   * preview and demos). Turn off only once live credentials + a public webhook URL exist.
   */
  paymentSimulation: boolean
  razorpayMode: "test" | "live"
  razorpayKeyId: string
  razorpayKeySecret: string
  /** PhonePe Standard Checkout v2 (OAuth) credentials. */
  phonepeMode: "test" | "live"
  phonepeClientId: string
  phonepeClientSecret: string
  /** Client version shared by PhonePe (defaults to "1"). */
  phonepeClientVersion: string
  /**
   * When true, no real email provider is called — sends are logged/counted only
   * (used in the v0 preview). Turn off once MSG91 SMTP is configured and the domain verified.
   */
  emailSimulation: boolean
  /** MSG91 SMTP host (usually "smtp.mailer91.com"). */
  smtpHost: string
  /** MSG91 SMTP port (587 STARTTLS, or 465 SSL). */
  smtpPort: number
  /** MSG91 SMTP username (from MSG91 Email → SMTP settings). */
  smtpUser: string
  /** MSG91 SMTP password. */
  smtpPassword: string
  /** Verified sender address, e.g. "no-reply@yourdomain.com" (must be on the verified domain). */
  smtpFromEmail: string
  /** Friendly sender name shown to recipients. */
  smtpFromName: string
}

/** Default lap options offered when none are configured (1–10, matching the original range). */
const DEFAULT_LAP_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const DEFAULTS: SiteSettings = {
  bookingsPaused: false,
  maintenanceMessage: "We are performing fleet maintenance. Bookings will reopen shortly.",
  lapDistanceKm: LAP_DISTANCE_KM,
  lapOptions: DEFAULT_LAP_OPTIONS,
  minLeadDays: 1,
  discount: DISCOUNT_ONE_LAP,
  reelPrice: REEL_PRICE,
  gstRate: GST_RATE,
  location: "https://maps.app.goo.gl/KrwxNWrF446u2vEf8",
  locationCoords: "13.240241244983078, 77.27872189502081",
  paymentGateway: "razorpay",
  paymentSimulation: true,
  razorpayMode: "test",
  razorpayKeyId: "",
  razorpayKeySecret: "",
  phonepeMode: "test",
  phonepeClientId: "",
  phonepeClientSecret: "",
  phonepeClientVersion: "1",
  emailSimulation: true,
  smtpHost: "smtp.mailer91.com",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpFromEmail: "",
  smtpFromName: "",
}

/** Parses a stored rate string, keeping explicit 0 but falling back for missing/invalid values. */
function parseRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
}

/** Parses a stored non-negative integer amount (e.g. a price), keeping explicit 0. */
function parseAmount(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback
}

/** Parses a stored CSV of lap counts into a sorted, unique list of ints within 1–30. */
function parseLapOptions(raw: string | undefined, fallback: number[]): number[] {
  if (!raw) return fallback
  const parsed = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30),
    ),
  ).sort((a, b) => a - b)
  return parsed.length > 0 ? parsed : fallback
}

/** Reads all global settings from the DB, falling back to code defaults for any missing key. */
export async function getSettings(): Promise<SiteSettings> {
  try {
    const res = await pool.query(`SELECT key, value FROM site_settings`)
    const map = new Map<string, string>(res.rows.map((r) => [r.key, r.value ?? ""]))
    return {
      bookingsPaused: (map.get("bookings_paused") ?? "false") === "true",
      maintenanceMessage: map.get("maintenance_message") || DEFAULTS.maintenanceMessage,
      lapDistanceKm: Number(map.get("lap_distance_km")) || DEFAULTS.lapDistanceKm,
      lapOptions: parseLapOptions(map.get("lap_options"), DEFAULTS.lapOptions),
      // Lead time can legitimately be 0 (same-day allowed), so honour an explicit stored value.
      minLeadDays: parseAmount(map.get("min_lead_days"), DEFAULTS.minLeadDays),
      // The discount can legitimately be 0, so honour an explicit stored value.
      // Backed by the existing `discount_one_lap` row (now the single universal rate).
      discount: parseRate(map.get("discount_one_lap"), DEFAULTS.discount),
      // Reel price can be 0 (free reel), so honour an explicit stored value.
      reelPrice: parseAmount(map.get("reel_price"), DEFAULTS.reelPrice),
      // GST can legitimately be 0, so honour an explicit stored value.
      gstRate: parseRate(map.get("gst_rate"), DEFAULTS.gstRate),
      location: map.get("location") || DEFAULTS.location,
      locationCoords: map.get("location_coords") || DEFAULTS.locationCoords,
      paymentGateway: map.get("payment_gateway") === "phonepe" ? "phonepe" : "razorpay",
      // Default to simulation ON unless an admin has explicitly turned it off.
      paymentSimulation: (map.get("payment_simulation") ?? "true") !== "false",
      razorpayMode: (map.get("razorpay_mode") as "test" | "live") || "test",
      razorpayKeyId: map.get("razorpay_key_id") ?? "",
      razorpayKeySecret: map.get("razorpay_key_secret") ?? "",
      phonepeMode: (map.get("phonepe_mode") as "test" | "live") || "test",
      phonepeClientId: map.get("phonepe_client_id") ?? "",
      phonepeClientSecret: map.get("phonepe_client_secret") ?? "",
      phonepeClientVersion: map.get("phonepe_client_version") || "1",
      emailSimulation: (map.get("email_simulation") ?? "true") !== "false",
      smtpHost: map.get("smtp_host") || "smtp.mailer91.com",
      smtpPort: Number.parseInt(map.get("smtp_port") || "587", 10) || 587,
      smtpUser: map.get("smtp_user") ?? "",
      smtpPassword: map.get("smtp_password") ?? "",
      smtpFromEmail: map.get("smtp_from_email") ?? "",
      smtpFromName: map.get("smtp_from_name") ?? "",
    }
  } catch (err) {
    console.log("[v0] getSettings failed, using defaults:", (err as Error).message)
    return DEFAULTS
  }
}

/** Lightweight public read for the storefront — only what the front-end needs. */
export async function getPublicSettings(): Promise<{
  bookingsPaused: boolean
  maintenanceMessage: string
  lapDistanceKm: number
  lapOptions: number[]
  minLeadDays: number
  discount: number
  reelPrice: number
  gstRate: number
  locationCoords: string
}> {
  const s = await getSettings()
  return {
    bookingsPaused: s.bookingsPaused,
    maintenanceMessage: s.maintenanceMessage,
    lapDistanceKm: s.lapDistanceKm,
    lapOptions: s.lapOptions,
    minLeadDays: s.minLeadDays,
    discount: s.discount,
    reelPrice: s.reelPrice,
    gstRate: s.gstRate,
    locationCoords: s.locationCoords,
  }
}

/** Server-only helper: the current discount rate in the shape `calculatePrice` expects. */
export async function getDiscountRates(): Promise<{ discount: number }> {
  const s = await getSettings()
  return { discount: s.discount }
}

/** Server-only helper: the current per-reel add-on price. */
export async function getReelPrice(): Promise<number> {
  const s = await getSettings()
  return s.reelPrice
}

/** Server-only helper: the current GST rate (fraction). */
export async function getGstRate(): Promise<number> {
  const s = await getSettings()
  return s.gstRate
}
