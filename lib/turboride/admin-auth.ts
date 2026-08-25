import "server-only"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { pool } from "@/lib/db"

const ADMIN_COOKIE = "tr_admin_session"
const SESSION_DAYS = 7

export type AdminUser = {
  id: string
  email: string
  name: string
  role: string
}

/** Create a session row + httpOnly cookie for an authenticated admin. */
export async function createAdminSession(adminId: string): Promise<void> {
  const token = randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await pool.query(
    `INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES ($1, $2, $3)`,
    [token, adminId, expires],
  )
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires,
  })
}

/** Resolve the currently signed-in admin from the session cookie, or null. */
export async function getAdmin(): Promise<AdminUser | null> {
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  if (!token) return null

  const res = await pool.query(
    `SELECT a.id, a.email, a.name, a.role
     FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  )
  const row = res.rows[0]
  if (!row) return null
  return { id: row.id, email: row.email, name: row.name, role: row.role }
}

/** Destroy the current admin session (DB row + cookie). */
export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  if (token) {
    await pool.query(`DELETE FROM admin_sessions WHERE token = $1`, [token])
    jar.delete(ADMIN_COOKIE)
  }
}
