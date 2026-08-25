"use server"

import { revalidatePath } from "next/cache"
import { pool } from "@/lib/db"
import { getAdmin } from "@/lib/turboride/admin-auth"

export type ActionResult = { ok: boolean; error?: string }

async function requireAdmin() {
  const admin = await getAdmin()
  if (!admin) throw new Error("Unauthorized")
  return admin
}

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Block a single date or a date range for maintenance / private events. */
export async function addBlackout(startDate: string, endDate: string, reason: string): Promise<ActionResult> {
  await requireAdmin()
  if (!isYmd(startDate) || !isYmd(endDate)) return { ok: false, error: "Invalid dates." }
  const start = startDate <= endDate ? startDate : endDate
  const end = startDate <= endDate ? endDate : startDate

  await pool.query(
    `INSERT INTO blackout_dates (start_date, end_date, reason) VALUES ($1, $2, $3)`,
    [start, end, reason.trim() || null],
  )
  revalidatePath("/admin/schedule")
  revalidatePath("/")
  return { ok: true }
}

/** Remove a blackout range. */
export async function removeBlackout(id: string): Promise<ActionResult> {
  await requireAdmin()
  await pool.query(`DELETE FROM blackout_dates WHERE id = $1`, [id])
  revalidatePath("/admin/schedule")
  revalidatePath("/")
  return { ok: true }
}

/** Update a time slot's capacity and active state. */
export async function updateSlot(slot: string, capacity: number, isActive: boolean): Promise<ActionResult> {
  await requireAdmin()
  const cap = Math.max(0, Math.floor(capacity) || 0)
  const res = await pool.query(
    `UPDATE slot_settings SET capacity = $2, is_active = $3 WHERE slot = $1`,
    [slot, cap, isActive],
  )
  if (res.rowCount === 0) return { ok: false, error: "Slot not found." }
  revalidatePath("/admin/schedule")
  revalidatePath("/")
  return { ok: true }
}
