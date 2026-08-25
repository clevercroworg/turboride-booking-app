"use server"

import { cookies } from "next/headers"
import { randomUUID } from "crypto"
import { pool } from "@/lib/db"
import {
  bookingMatchClause,
  normalizeIdentifier,
  type Channel,
} from "@/lib/turboride/identifier"

const SESSION_COOKIE = "tr_session"
const OTP_TTL_MIN = 10
const SESSION_TTL_DAYS = 30

export type RequestOtpResult =
  | { ok: true; channel: Channel; masked: string; demoCode: string }
  | { ok: false; error: string }

/**
 * Issues a 4-digit login OTP for a customer who has an existing booking.
 * NOTE: there is no SMS/email provider wired up, so this is a demo — the code is
 * returned to the client and surfaced in the UI. Swap in Resend/Twilio to send for real.
 */
export async function requestLoginOtp(raw: string): Promise<RequestOtpResult> {
  const parsed = normalizeIdentifier(raw)
  if (!parsed) return { ok: false, error: "Enter a valid email address or 10-digit mobile number." }

  const { identifier, channel } = parsed
  const { clause, param } = bookingMatchClause(identifier)

  const existing = await pool.query(
    `SELECT customer_email, customer_phone FROM bookings WHERE ${clause} LIMIT 1`,
    [param],
  )
  if (existing.rows.length === 0) {
    return { ok: false, error: "No booking found for that email or mobile number." }
  }

  const code = String(Math.floor(1000 + Math.random() * 9000))
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60_000)

  await pool.query(
    `INSERT INTO login_otps (identifier, code, channel, expires_at, attempts)
     VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (identifier) DO UPDATE
       SET code = EXCLUDED.code, channel = EXCLUDED.channel, expires_at = EXCLUDED.expires_at, attempts = 0`,
    [identifier, code, channel, expires.toISOString()],
  )

  console.log("[v0] Login OTP for", identifier, "->", code)

  const masked =
    channel === "email"
      ? identifier.replace(/^(.).*(@.*)$/, "$1•••$2")
      : "••• ••• " + identifier.slice(-4)

  return { ok: true, channel, masked, demoCode: code }
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string }

export async function verifyLoginOtp(raw: string, code: string): Promise<VerifyOtpResult> {
  const parsed = normalizeIdentifier(raw)
  if (!parsed) return { ok: false, error: "Enter a valid email address or mobile number." }
  const { identifier } = parsed
  const clean = code.replace(/\D/g, "")

  const res = await pool.query(
    `SELECT code, expires_at, attempts FROM login_otps WHERE identifier = $1`,
    [identifier],
  )
  const row = res.rows[0]
  if (!row) return { ok: false, error: "Request a new code to continue." }
  if (row.attempts >= 5) return { ok: false, error: "Too many attempts. Request a new code." }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Request a new one." }
  }
  if (row.code !== clean) {
    await pool.query(`UPDATE login_otps SET attempts = attempts + 1 WHERE identifier = $1`, [identifier])
    return { ok: false, error: "Incorrect code. Please try again." }
  }

  // Success: consume the OTP and open a session.
  await pool.query(`DELETE FROM login_otps WHERE identifier = $1`, [identifier])

  const token = randomUUID()
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)
  await pool.query(
    `INSERT INTO account_sessions (token, identifier, expires_at) VALUES ($1,$2,$3)`,
    [token, identifier, expires.toISOString()],
  )

  const jar = await cookies()
  const isDev = process.env.NODE_ENV === "development"
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // The v0 preview renders inside a cross-site iframe, so the cookie needs SameSite=None; Secure in dev.
    sameSite: isDev ? "none" : "lax",
    secure: true,
    path: "/",
    expires,
  })

  return { ok: true }
}

/** Resolve the logged-in customer's identifier from the session cookie, or null. */
export async function getSessionIdentifier(): Promise<string | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const res = await pool.query(
    `SELECT identifier, expires_at FROM account_sessions WHERE token = $1`,
    [token],
  )
  const row = res.rows[0]
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await pool.query(`DELETE FROM account_sessions WHERE token = $1`, [token])
    return null
  }
  return row.identifier as string
}

export async function logout(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await pool.query(`DELETE FROM account_sessions WHERE token = $1`, [token])
    jar.delete(SESSION_COOKIE)
  }
}
