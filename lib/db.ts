import { Pool } from "pg"

const globalForDb = globalThis as unknown as { pool?: Pool }

function createPool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url) {
    return new Pool()
  }
  const cleanUrl = url.replace(/([?&])sslmode=[^&]*(&|$)/, "$1").replace(/[?&]$/, "")
  return new Pool({
    connectionString: cleanUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  })
}

export const pool = globalForDb.pool ?? createPool()

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool
