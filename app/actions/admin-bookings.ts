"use server"

import { revalidatePath } from "next/cache"
import { pool } from "@/lib/db"
import { getAdmin } from "@/lib/turboride/admin-auth"

const ALLOWED_STATUSES = new Set([
  "confirmed",
  "prebook_pending",
  "scheduled",
  "cancelled",
  "refunded",
  "redeemed",
])

export type ActionResult = { ok: boolean; error?: string }

async function requireAdmin() {
  const admin = await getAdmin()
  if (!admin) throw new Error("Unauthorized")
  return admin
}

/** Update a booking's status (admin only). */
export async function updateBookingStatus(reference: string, status: string): Promise<ActionResult> {
  await requireAdmin()
  if (!ALLOWED_STATUSES.has(status)) return { ok: false, error: "Invalid status." }

  // Redeeming means the customer completed their experience and settled the balance in person,
  // so the outstanding balance drops to zero (amount_paid catches up to total).
  const res = await pool.query(
    `UPDATE bookings
       SET status = $2,
           amount_paid = CASE WHEN $2 = 'redeemed' THEN total ELSE amount_paid END
     WHERE id = $1`,
    [reference, status],
  )
  if (res.rowCount === 0) return { ok: false, error: "Booking not found." }

  revalidatePath("/admin/bookings")
  revalidatePath("/admin")
  return { ok: true }
}

/** Attach / edit the payment (Razorpay) reference ID for a booking (admin only). */
export async function updateBookingPaymentId(reference: string, paymentId: string): Promise<ActionResult> {
  await requireAdmin()
  const clean = paymentId.trim() || null
  const res = await pool.query(`UPDATE bookings SET payment_id = $2 WHERE id = $1`, [reference, clean])
  if (res.rowCount === 0) return { ok: false, error: "Booking not found." }

  revalidatePath("/admin/bookings")
  return { ok: true }
}
