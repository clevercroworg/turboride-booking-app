import "server-only"
import { pool } from "@/lib/db"

export type AdminStats = {
  totalBookings: number
  confirmedBookings: number
  totalRevenue: number
  collectedRevenue: number
  totalCustomers: number
  activeCars: number
}

/** Aggregate platform stats for the admin dashboard overview. */
export async function getAdminStats(): Promise<AdminStats> {
  // A row only counts as a real booking once payment succeeds: exclude in-flight/abandoned
  // `pending` checkouts and never-paid `cancelled` rows (failed payments) from all stats.
  const REAL_BOOKING = `status <> 'pending' AND NOT (status = 'cancelled' AND amount_paid = 0)`
  const [bookings, customers, cars] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('confirmed', 'scheduled'))::int AS confirmed,
        COALESCE(SUM(total), 0)::bigint AS revenue,
        COALESCE(SUM(amount_paid), 0)::bigint AS collected
      FROM bookings
      WHERE ${REAL_BOOKING}
    `),
    pool.query(`SELECT COUNT(DISTINCT lower(customer_email))::int AS n FROM bookings WHERE ${REAL_BOOKING}`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE is_active = true)::int AS n FROM cars`),
  ])

  const b = bookings.rows[0]
  return {
    totalBookings: b.total,
    confirmedBookings: b.confirmed,
    totalRevenue: Number(b.revenue),
    collectedRevenue: Number(b.collected),
    totalCustomers: customers.rows[0].n,
    activeCars: cars.rows[0].n,
  }
}

export type RecentBooking = {
  reference: string
  customerName: string
  /** Name of the first car in the lineup (the headline car). */
  carName: string
  /** Total cars in the lineup — used to render a "+N more" hint for multi-car bookings. */
  carCount: number
  total: number
  status: string
  createdAt: string
}

/** Most recent bookings for the dashboard activity feed. */
export async function getRecentBookings(limit = 8): Promise<RecentBooking[]> {
  const res = await pool.query(
    `SELECT id, customer_name, car_name, cars, status, total, created_at
     FROM bookings
     WHERE status <> 'pending' AND NOT (status = 'cancelled' AND amount_paid = 0)
     ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return res.rows.map((r) => {
    // Prefer the stored multi-car lineup; fall back to the single car_name for legacy bookings.
    const lineup = Array.isArray(r.cars) ? (r.cars as { carName?: string }[]) : []
    const carName = lineup.length > 0 ? (lineup[0].carName ?? r.car_name) : r.car_name
    const carCount = Math.max(1, lineup.length)
    return {
      reference: r.id,
      customerName: r.customer_name,
      carName,
      carCount,
      total: Number(r.total),
      status: r.status,
      createdAt: r.created_at,
    }
  })
}
