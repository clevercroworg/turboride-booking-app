import { Pool } from "pg"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function initAdmin() {
  const hash = await bcrypt.hash("TurboAdmin!2026", 10)
  
  const emails = ["admin@turboride.com", "admin@dct.com"]
  
  for (const email of emails) {
    const existing = await pool.query("SELECT * FROM admins WHERE lower(email) = $1", [email])
    if (existing.rows.length === 0) {
      await pool.query(
        "INSERT INTO admins (email, name, role, password_hash) VALUES ($1, $2, $3, $4)",
        [email, "TurboRide Administrator", "superadmin", hash]
      )
      console.log("Admin user created:", email)
    } else {
      await pool.query(
        "UPDATE admins SET password_hash = $1 WHERE lower(email) = $2",
        [hash, email]
      )
      console.log("Admin password updated:", email)
    }
  }

  const allAdmins = await pool.query("SELECT email, role, last_login_at FROM admins")
  console.log("Registered Admin Users:", allAdmins.rows)

  const allCars = await pool.query("SELECT id, name, status, price_per_lap FROM cars")
  console.log("Current Cars in DB:", allCars.rows)

  await pool.end()
}

initAdmin().catch(console.error)
