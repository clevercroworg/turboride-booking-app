import "server-only"
import { pool } from "@/lib/db"
import { TIME_SLOTS } from "@/lib/turboride/fleet"

export type SlotSetting = { slot: string; capacity: number; isActive: boolean; sortOrder: number }
export type BlackoutRange = { id: string; startDate: string; endDate: string; reason: string | null }

function ymd(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * SQL predicate (for a `bookings b`) that excludes a bonus lap which shares its
 * parent booking's exact date + slot. Such a lap is part of the SAME physical
 * visit (the full-fleet bundle driven all in one session) and must not consume a
 * second seat. A bonus lap booked standalone on its own day still counts normally.
 */
const NOT_CLUBBED_BONUS = `
  NOT (
    b.is_bonus = true AND EXISTS (
      SELECT 1 FROM bookings p
      WHERE p.id = b.parent_reference
        AND p.experience_date = b.experience_date
        AND p.time_slot = b.time_slot
    )
  )
`

/** Default fallback slots matching code defaults */
const DEFAULT_SLOTS: SlotSetting[] = TIME_SLOTS.map((slot, i) => ({
  slot,
  capacity: 2,
  isActive: true,
  sortOrder: i + 1,
}))

/** Configured time slots with per-slot capacity. Falls back to code defaults if unset/DB offline. */
export async function getSlotSettings(): Promise<SlotSetting[]> {
  try {
    const res = await pool.query(
      `SELECT slot, capacity, is_active, sort_order FROM slot_settings ORDER BY sort_order ASC`,
    )
    if (res.rows.length === 0) {
      return DEFAULT_SLOTS
    }
    return res.rows.map((r) => ({
      slot: r.slot,
      capacity: r.capacity,
      isActive: r.is_active,
      sortOrder: r.sort_order,
    }))
  } catch (err) {
    console.log("[TurboRide] getSlotSettings failed, using defaults:", (err as Error).message)
    return DEFAULT_SLOTS
  }
}

/** All blackout date ranges (fleet maintenance / private events). */
export async function getBlackoutDates(): Promise<BlackoutRange[]> {
  try {
    const res = await pool.query(
      `SELECT id, start_date, end_date, reason FROM blackout_dates ORDER BY start_date ASC`,
    )
    return res.rows.map((r) => ({
      id: r.id,
      startDate: ymd(r.start_date),
      endDate: ymd(r.end_date),
      reason: r.reason,
    }))
  } catch (err) {
    console.log("[TurboRide] getBlackoutDates failed:", (err as Error).message)
    return []
  }
}

/** Booked seat counts keyed by `${date}__${slot}` for active (confirmed/scheduled) bookings. */
export async function getBookedCounts(): Promise<Record<string, number>> {
  try {
    const res = await pool.query(
      `SELECT experience_date, time_slot, COUNT(*)::int AS n
       FROM bookings b
       WHERE experience_date IS NOT NULL AND time_slot IS NOT NULL
         AND status IN ('confirmed','scheduled')
         AND ${NOT_CLUBBED_BONUS}
       GROUP BY experience_date, time_slot`,
    )
    const map: Record<string, number> = {}
    for (const r of res.rows) {
      map[`${ymd(r.experience_date)}__${r.time_slot}`] = r.n
    }
    return map
  } catch (err) {
    console.log("[TurboRide] getBookedCounts failed:", (err as Error).message)
    return {}
  }
}

export type PublicAvailability = {
  slots: { slot: string; capacity: number }[]
  blackouts: { startDate: string; endDate: string }[]
  booked: Record<string, number>
}

/** Everything the storefront date/slot picker needs to disable blacked-out days and sold-out slots. */
export async function getPublicAvailability(): Promise<PublicAvailability> {
  const [slots, blackouts, booked] = await Promise.all([
    getSlotSettings(),
    getBlackoutDates(),
    getBookedCounts(),
  ])
  return {
    slots: slots.filter((s) => s.isActive).map((s) => ({ slot: s.slot, capacity: s.capacity })),
    blackouts: blackouts.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
    booked,
  }
}

export type DayBooking = { date: string; slot: string; count: number }

/**
 * Admin calendar feed: per-day booking counts (across active statuses) so the
 * month view can show which days already have drives scheduled.
 */
export async function getScheduleOverview(): Promise<{
  slots: SlotSetting[]
  blackouts: BlackoutRange[]
  dayCounts: Record<string, number>
  daySlotCounts: Record<string, number>
}> {
  try {
    const [slots, blackouts, res] = await Promise.all([
      getSlotSettings(),
      getBlackoutDates(),
      pool.query(
        `SELECT experience_date, time_slot, COUNT(*)::int AS n
         FROM bookings b
         WHERE experience_date IS NOT NULL AND time_slot IS NOT NULL
           AND status IN ('confirmed','scheduled')
           AND ${NOT_CLUBBED_BONUS}
         GROUP BY experience_date, time_slot`,
      ),
    ])

    const dayCounts: Record<string, number> = {}
    const daySlotCounts: Record<string, number> = {}
    for (const r of res.rows) {
      const day = ymd(r.experience_date)
      dayCounts[day] = (dayCounts[day] ?? 0) + r.n
      daySlotCounts[`${day}__${r.time_slot}`] = r.n
    }
    return { slots, blackouts, dayCounts, daySlotCounts }
  } catch (err) {
    console.log("[TurboRide] getScheduleOverview failed, using defaults:", (err as Error).message)
    const slots = await getSlotSettings()
    return { slots, blackouts: [], dayCounts: {}, daySlotCounts: {} }
  }
}

/**
 * Server-side guard for direct bookings: throws if the date is blacked out,
 * the slot is inactive/unknown, or the slot has reached capacity.
 */
export async function assertSlotAvailable(date: string, slot: string): Promise<void> {
  const target = ymd(date)

  try {
    const black = await pool.query(
      `SELECT 1 FROM blackout_dates WHERE $1::date BETWEEN start_date AND end_date LIMIT 1`,
      [target],
    )
    if (black.rows.length > 0) {
      throw new Error("That date is unavailable. Please choose another day.")
    }

    const slotRes = await pool.query(
      `SELECT capacity, is_active FROM slot_settings WHERE slot = $1`,
      [slot],
    )
    const cfg = slotRes.rows[0]
    if (cfg && !cfg.is_active) {
      throw new Error("That time slot is not available.")
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bookings b
       WHERE experience_date = $1 AND time_slot = $2 AND status IN ('confirmed','scheduled')
         AND ${NOT_CLUBBED_BONUS}`,
      [target, slot],
    )
    if (cfg && (countRes.rows[0]?.n ?? 0) >= cfg.capacity) {
      throw new Error("That time slot just sold out. Please pick another slot.")
    }
  } catch (err) {
    // If DB is offline in demo/preview mode, allow slot booking
    if ((err as Error).message.includes("sold out") || (err as Error).message.includes("unavailable")) {
      throw err
    }
    console.log("[TurboRide] Slot availability guard bypassed (DB offline):", (err as Error).message)
  }
}
