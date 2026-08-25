"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { pool } from "@/lib/db"
import { createAdminSession, destroyAdminSession } from "@/lib/turboride/admin-auth"

export type AdminLoginResult = { ok: boolean; error?: string }

export async function adminLogin(_prev: AdminLoginResult, formData: FormData): Promise<AdminLoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return { ok: false, error: "Enter your email and password." }

  const res = await pool.query(
    `SELECT id, password_hash FROM admins WHERE lower(email) = $1`,
    [email],
  )
  const admin = res.rows[0]
  // Constant-ish response: same message whether the email or the password is wrong.
  if (!admin) return { ok: false, error: "Invalid email or password." }

  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return { ok: false, error: "Invalid email or password." }

  await pool.query(`UPDATE admins SET last_login_at = now() WHERE id = $1`, [admin.id])
  await createAdminSession(admin.id)
  return { ok: true }
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession()
  redirect("/admin/login")
}
