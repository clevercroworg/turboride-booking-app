"use server"

import { revalidatePath } from "next/cache"
import { pool } from "@/lib/db"
import { getAdmin } from "@/lib/turboride/admin-auth"
import type { CarStatus } from "@/lib/turboride/fleet"

export type FleetActionResult = { ok: boolean; error?: string }

const VALID_STATUS: CarStatus[] = ["available", "comingsoon", "paused"]

export type CarInput = {
  id: string
  name: string
  brand: string
  image: string
  status: string
  pricePerLap: number
  pricePerRideAlongLap: number
  regularPrice: number | null
  deposit: number | null
  bookingType: string
  specs: { label: string; value: string }[]
  perks: string[]
  accent: string
  exShowroom: string | null
  isActive: boolean
}

async function isAdmin() {
  const admin = await getAdmin()
  return Boolean(admin)
}

/** Re-render every storefront surface that reads the fleet so edits go live instantly. */
function revalidateStorefront() {
  revalidatePath("/") // landing grid + booking carousel
  revalidatePath("/account") // booking cards
  revalidatePath("/admin/fleet")
  revalidatePath("/admin")
}

function validate(input: CarInput): string | null {
  if (!input.name.trim()) return "Name is required."
  if (!input.brand.trim()) return "Brand is required."
  if (!VALID_STATUS.includes(input.status as CarStatus)) return "Invalid status."
  if (!Number.isInteger(input.pricePerLap) || input.pricePerLap < 0) return "Price per lap must be a positive number."
  if (!Number.isInteger(input.pricePerRideAlongLap) || input.pricePerRideAlongLap < 0)
    return "Price per ride-along lap must be a positive number (use 0 to disable the add-on)."
  if (input.regularPrice != null && (!Number.isInteger(input.regularPrice) || input.regularPrice < 0))
    return "Launch price must be a positive number."
  if (input.deposit != null && (!Number.isInteger(input.deposit) || input.deposit < 0))
    return "Deposit must be a positive number."
  return null
}

/** Update an existing car; edits reflect on the live storefront immediately. */
export async function updateCar(input: CarInput): Promise<FleetActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Your admin session expired. Please sign in again." }
  const err = validate(input)
  if (err) return { ok: false, error: err }

  try {
    const res = await pool.query(
      `UPDATE cars SET
         name = $2, brand = $3, image = $4, status = $5,
         price_per_lap = $6, regular_price = $7, deposit = $8,
         booking_type = $9, specs = $10::jsonb, perks = $11::jsonb,
         accent = $12, is_active = $13, ex_showroom = $14,
         price_per_ride_along_lap = $15, updated_at = now()
       WHERE id = $1`,
      [
        input.id,
        input.name.trim(),
        input.brand.trim(),
        input.image.trim() || "/placeholder.svg",
        input.status,
        input.pricePerLap,
        input.regularPrice,
        input.deposit,
        input.bookingType.trim(),
        JSON.stringify(input.specs),
        JSON.stringify(input.perks),
        input.accent.trim(),
        input.isActive,
        input.exShowroom?.trim() || null,
        input.pricePerRideAlongLap,
      ],
    )
    if (res.rowCount === 0) return { ok: false, error: "Car not found." }

    revalidateStorefront()
    return { ok: true }
  } catch (e) {
    console.error("[v0] updateCar failed:", e)
    return { ok: false, error: "Could not save changes. Please try again." }
  }
}

/**
 * Permanently delete a car from the fleet. Refuses if the car still has bookings
 * so receipts and history are never orphaned — the admin can hide it instead.
 */
export async function deleteCar(id: string): Promise<FleetActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Your admin session expired. Please sign in again." }
  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM bookings WHERE car_id = $1`,
      [id],
    )
    const bookingCount = Number(rows[0]?.count ?? 0)
    if (bookingCount > 0) {
      return {
        ok: false,
        error: `This car has ${bookingCount} booking${bookingCount === 1 ? "" : "s"} and can't be deleted. Hide it from the storefront instead.`,
      }
    }

    const res = await pool.query(`DELETE FROM cars WHERE id = $1`, [id])
    if (res.rowCount === 0) return { ok: false, error: "Car not found." }

    revalidateStorefront()
    return { ok: true }
  } catch (e) {
    console.error("[v0] deleteCar failed:", e)
    return { ok: false, error: "Could not delete this car. Please try again." }
  }
}

/** Toggle a car's active flag (show/hide on the storefront) without opening the editor. */
export async function toggleCarActive(id: string, isActive: boolean): Promise<FleetActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Your admin session expired. Please sign in again." }
  try {
    const res = await pool.query(`UPDATE cars SET is_active = $2, updated_at = now() WHERE id = $1`, [id, isActive])
    if (res.rowCount === 0) return { ok: false, error: "Car not found." }
    revalidateStorefront()
    return { ok: true }
  } catch (e) {
    console.error("[v0] toggleCarActive failed:", e)
    return { ok: false, error: "Could not update visibility. Please try again." }
  }
}
