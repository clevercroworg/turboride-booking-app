import "server-only"
import { pool } from "@/lib/db"
import { SEED_FLEET, type Car, type CarStatus } from "./fleet"

type CarRow = {
  id: string
  name: string
  brand: string
  image: string
  status: string
  price_per_lap: number
  price_per_ride_along_lap: number | null
  regular_price: number | null
  deposit: number | null
  booking_type: string
  specs: { label: string; value: string }[]
  perks: string[]
  accent: string
  ex_showroom: string | null
  sort_order: number
  is_active: boolean
}

function mapRow(row: CarRow): Car {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    image: row.image,
    status: row.status as CarStatus,
    pricePerLap: Number(row.price_per_lap),
    pricePerRideAlongLap: row.price_per_ride_along_lap != null ? Number(row.price_per_ride_along_lap) : 0,
    regularPrice: row.regular_price != null ? Number(row.regular_price) : undefined,
    deposit: row.deposit != null ? Number(row.deposit) : undefined,
    bookingType: row.booking_type,
    specs: Array.isArray(row.specs) ? row.specs : [],
    perks: Array.isArray(row.perks) && row.perks.length > 0 ? row.perks : undefined,
    accent: row.accent,
    exShowroom: row.ex_showroom ?? undefined,
  }
}

/** Public fleet: active cars only, ordered for the storefront. Falls back to seed data on error. */
export async function getFleet(): Promise<Car[]> {
  try {
    const res = await pool.query<CarRow>(
      `SELECT * FROM cars WHERE is_active = true ORDER BY sort_order ASC, created_at ASC`,
    )
    return res.rows.length === 0 ? SEED_FLEET : res.rows.map(mapRow)
  } catch (err) {
    console.log("[v0] getFleet failed, using seed fleet:", (err as Error).message)
    return SEED_FLEET
  }
}

/** Admin fleet: every car including inactive ones, with usage-relevant metadata. */
export async function getAllCars(): Promise<(Car & { isActive: boolean; sortOrder: number })[]> {
  const res = await pool.query<CarRow>(`SELECT * FROM cars ORDER BY sort_order ASC, created_at ASC`)
  return res.rows.map((r) => ({ ...mapRow(r), isActive: r.is_active, sortOrder: r.sort_order }))
}

/** Single car by id, from the DB (server-side source of truth for booking validation). */
export async function getCarById(id: string | null): Promise<Car | undefined> {
  if (!id) return undefined
  const res = await pool.query<CarRow>(`SELECT * FROM cars WHERE id = $1`, [id])
  return res.rows.length === 0 ? SEED_FLEET.find((c) => c.id === id) : mapRow(res.rows[0])
}
