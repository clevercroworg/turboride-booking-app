"use server"

import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { pool } from "@/lib/db"
import { getAdmin } from "@/lib/turboride/admin-auth"
import { phonepeTestConnection } from "@/lib/turboride/payments/phonepe"
import { razorpayTestConnection } from "@/lib/turboride/payments/razorpay"
import { testSmtpConnection } from "@/lib/turboride/email"

export type ActionResult = { ok: boolean; error?: string }

async function requireAdmin() {
  const admin = await getAdmin()
  if (!admin) throw new Error("Unauthorized")
  return admin
}

async function setSetting(key: string, value: string) {
  await pool.query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  )
}

export type GlobalSettingsInput = {
  bookingsPaused: boolean
  maintenanceMessage: string
  lapDistanceKm: number
  /** Lap counts to offer customers in the booking step (integers 1–30). */
  lapOptions: number[]
  /** Minimum booking lead time in days (0 = same-day allowed, 1 = earliest tomorrow). */
  minLeadDays: number
  /** Universal full-pay discount, entered as a percentage (e.g. 15). */
  discount: number
  /** Price per Instagram reel add-on, in ₹. */
  reelPrice: number
  /** GST rate, entered as a percentage (e.g. 18). */
  gstRate: number
  /** Drive location — a Google Maps link shown to customers and used in the {{location}} email tag. */
  location: string
  /** Venue coordinates as "lat, lng" — powers the embedded map on the confirmation page. */
  locationCoords: string
}

/** Save global controls, then revalidate the storefront + admin. */
export async function updateGlobalSettings(input: GlobalSettingsInput): Promise<ActionResult> {
  await requireAdmin()

  const lapKm = Math.max(1, Math.floor(input.lapDistanceKm) || 15)
  const cleanedLapOptions = Array.from(
    new Set(
      (Array.isArray(input.lapOptions) ? input.lapOptions : [])
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30),
    ),
  ).sort((a, b) => a - b)
  const lapOptions = cleanedLapOptions.length > 0 ? cleanedLapOptions : [1]
  const minLeadDays = Math.min(90, Math.max(0, Math.floor(Number(input.minLeadDays) || 0)))
  const discount = Math.min(1, Math.max(0, (Number(input.discount) || 0) / 100))
  const reelPrice = Math.max(0, Math.floor(Number(input.reelPrice) || 0))
  const gstRate = Math.min(1, Math.max(0, (Number(input.gstRate) || 0) / 100))

  await Promise.all([
    setSetting("bookings_paused", input.bookingsPaused ? "true" : "false"),
    setSetting("maintenance_message", input.maintenanceMessage.trim()),
    setSetting("lap_distance_km", String(lapKm)),
    setSetting("lap_options", lapOptions.join(",")),
    setSetting("min_lead_days", String(minLeadDays)),
    setSetting("discount_one_lap", String(discount)),
    setSetting("reel_price", String(reelPrice)),
    setSetting("gst_rate", String(gstRate)),
    setSetting("location", input.location.trim()),
    setSetting("location_coords", input.locationCoords.trim()),
  ])

  revalidatePath("/")
  revalidatePath("/account")
  revalidatePath("/admin")
  revalidatePath("/admin/settings")
  return { ok: true }
}

export type PaymentConfigInput = {
  /** Which gateway is used for live checkout. */
  gateway: "phonepe" | "razorpay"
  /** When true, no real gateway is called — bookings settle instantly (preview/demo). */
  simulation: boolean
  razorpay: {
    mode: "test" | "live"
    keyId: string
    keySecret: string
  }
  phonepe: {
    mode: "test" | "live"
    clientId: string
    clientSecret: string
    clientVersion: string
  }
}

/**
 * Store payment gateway config for BOTH PhonePe and Razorpay, plus the active gateway
 * selector and the simulation toggle. Live charges only happen when simulation is off
 * and the selected gateway has valid credentials.
 */
export async function updatePaymentConfig(input: PaymentConfigInput): Promise<ActionResult> {
  await requireAdmin()
  await Promise.all([
    setSetting("payment_gateway", input.gateway === "phonepe" ? "phonepe" : "razorpay"),
    setSetting("payment_simulation", input.simulation ? "true" : "false"),
    setSetting("razorpay_mode", input.razorpay.mode === "live" ? "live" : "test"),
    setSetting("razorpay_key_id", input.razorpay.keyId.trim()),
    setSetting("razorpay_key_secret", input.razorpay.keySecret.trim()),
    setSetting("phonepe_mode", input.phonepe.mode === "live" ? "live" : "test"),
    setSetting("phonepe_client_id", input.phonepe.clientId.trim()),
    setSetting("phonepe_client_secret", input.phonepe.clientSecret.trim()),
    setSetting("phonepe_client_version", (input.phonepe.clientVersion || "1").trim()),
  ])
  revalidatePath("/admin/settings")
  return { ok: true }
}

/** Test Payment Gateway credentials directly */
export async function testPaymentGatewayAction(input: {
  gateway: "phonepe" | "razorpay"
  phonepe?: { mode: "test" | "live"; clientId: string; clientSecret: string; clientVersion: string }
  razorpay?: { mode: "test" | "live"; keyId: string; keySecret: string }
}): Promise<{ ok: boolean; message: string }> {
  await requireAdmin()
  if (input.gateway === "phonepe") {
    if (!input.phonepe?.clientId || !input.phonepe?.clientSecret) {
      return { ok: false, message: "Please provide PhonePe Client ID / Merchant ID and Secret / Salt Key." }
    }
    return await phonepeTestConnection({
      mode: input.phonepe.mode,
      clientId: input.phonepe.clientId,
      clientSecret: input.phonepe.clientSecret,
      clientVersion: input.phonepe.clientVersion || "1",
    })
  }

  if (!input.razorpay?.keyId || !input.razorpay?.keySecret) {
    return { ok: false, message: "Please provide Razorpay Key ID and Secret." }
  }
  return await razorpayTestConnection({
    mode: input.razorpay.mode,
    keyId: input.razorpay.keyId,
    keySecret: input.razorpay.keySecret,
  })
}

export type EmailConfigInput = {
  /** When true, no real email provider is called — sends are logged/counted only. */
  simulation: boolean
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
  fromName: string
}

/** Store MSG91 SMTP email delivery config. */
export async function updateEmailConfig(input: EmailConfigInput): Promise<ActionResult> {
  await requireAdmin()
  const fromEmail = input.fromEmail.trim().toLowerCase()
  if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    return { ok: false, error: "Enter a valid sender email address." }
  }
  const port = Number.isFinite(input.port) && input.port > 0 ? Math.trunc(input.port) : 587
  await Promise.all([
    setSetting("email_simulation", input.simulation ? "true" : "false"),
    setSetting("smtp_host", input.host.trim()),
    setSetting("smtp_port", String(port)),
    setSetting("smtp_user", input.user.trim()),
    setSetting("smtp_password", input.password.trim()),
    setSetting("smtp_from_email", fromEmail),
    setSetting("smtp_from_name", input.fromName.trim()),
  ])
  revalidatePath("/admin/settings")
  return { ok: true }
}

/** Test MSG91 SMTP connection directly */
export async function testEmailDeliveryAction(input: {
  testRecipient: string
  config: {
    host: string
    port: number
    user: string
    password: string
    fromEmail: string
    fromName: string
  }
}): Promise<{ ok: boolean; message: string }> {
  await requireAdmin()
  return await testSmtpConnection(input.testRecipient, input.config)
}

export type AdminProfileInput = { name: string; email: string }

/** Update the signed-in admin's name and contact email. */
export async function updateAdminProfile(input: AdminProfileInput): Promise<ActionResult> {
  const admin = await requireAdmin()
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (name.length < 2) return { ok: false, error: "Name is too short." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." }

  try {
    await pool.query(`UPDATE admins SET name = $2, email = $3 WHERE id = $1`, [admin.id, name, email])
  } catch {
    return { ok: false, error: "That email is already in use." }
  }
  revalidatePath("/admin/settings")
  return { ok: true }
}

/** Change the signed-in admin's password after verifying the current one. */
export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (newPassword.length < 8) return { ok: false, error: "New password must be at least 8 characters." }

  const res = await pool.query(`SELECT password_hash FROM admins WHERE id = $1`, [admin.id])
  const hash = res.rows[0]?.password_hash
  if (!hash || !bcrypt.compareSync(currentPassword, hash)) {
    return { ok: false, error: "Current password is incorrect." }
  }

  const newHash = bcrypt.hashSync(newPassword, 10)
  await pool.query(`UPDATE admins SET password_hash = $2 WHERE id = $1`, [admin.id, newHash])
  return { ok: true }
}
