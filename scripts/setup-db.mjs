import { Pool } from "pg"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL is not set!")
  process.exit(1)
}

console.log("Connecting to Neon database...")
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function runMigration() {
  const client = await pool.connect()
  try {
    console.log("Creating tables in Neon...")

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL DEFAULT 'Admin',
        role TEXT NOT NULL DEFAULT 'superadmin',
        password_hash TEXT NOT NULL,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS cars (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        image TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        price_per_lap NUMERIC NOT NULL DEFAULT 10000,
        price_per_ride_along_lap NUMERIC DEFAULT 0,
        regular_price NUMERIC,
        deposit NUMERIC,
        booking_type TEXT DEFAULT 'Direct Booking',
        specs JSONB DEFAULT '[]'::jsonb,
        perks JSONB DEFAULT '[]'::jsonb,
        accent TEXT DEFAULT 'oklch(0.63 0.226 35)',
        ex_showroom TEXT,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        cars JSONB NOT NULL DEFAULT '[]'::jsonb,
        reels INT DEFAULT 0,
        experience_date TEXT,
        time_slot TEXT,
        payment_option TEXT DEFAULT 'full',
        payment_gateway TEXT DEFAULT 'simulated',
        payment_id TEXT,
        total NUMERIC NOT NULL DEFAULT 0,
        amount_paid NUMERIC NOT NULL DEFAULT 0,
        discount NUMERIC DEFAULT 0,
        tax NUMERIC DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'confirmed',
        is_bonus BOOLEAN DEFAULT false,
        parent_reference TEXT,
        reschedule_count INT DEFAULT 0,
        paid_in_full_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS slot_settings (
        slot TEXT PRIMARY KEY,
        capacity INT NOT NULL DEFAULT 2,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS blackout_dates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS login_otps (
        identifier TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        attempts INT DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS account_sessions (
        token TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `)

    console.log("Seeding Default Admin...")
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@turboride.com").toLowerCase()
    const adminPass = process.env.ADMIN_PASSWORD || "TurboAdmin!2026"
    const hash = await bcrypt.hash(adminPass, 10)

    await client.query(`
      INSERT INTO admins (email, name, role, password_hash)
      VALUES ($1, 'TurboRide Administrator', 'superadmin', $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, updated_at = now()
    `, [adminEmail, hash])

    console.log("Seeding Default Fleet...")
    const defaultCars = [
      {
        id: "porsche-718",
        name: "Porsche 718 Cayman",
        brand: "Porsche",
        image: "/cars/porsche-side.png",
        status: "available",
        price_per_lap: 10000,
        price_per_ride_along_lap: 2500,
        booking_type: "Direct Booking",
        accent: "oklch(0.55 0.13 250)",
        specs: JSON.stringify([
          { label: "0-100", value: "4.7s" },
          { label: "Power", value: "300 hp" },
          { label: "Top Speed", value: "275 km/h" },
        ]),
        sort_order: 1
      },
      {
        id: "lambo-huracan",
        name: "Lamborghini Huracán",
        brand: "Lamborghini",
        image: "/cars/lambo-side.png",
        status: "available",
        price_per_lap: 20000,
        price_per_ride_along_lap: 5000,
        booking_type: "Direct Booking",
        accent: "oklch(0.78 0.16 90)",
        specs: JSON.stringify([
          { label: "0-100", value: "2.9s" },
          { label: "Power", value: "640 hp" },
          { label: "Top Speed", value: "325 km/h" },
        ]),
        sort_order: 2
      },
      {
        id: "ferrari-488",
        name: "Ferrari 488 GTB",
        brand: "Ferrari",
        image: "/cars/ferrari-side.png",
        status: "available",
        price_per_lap: 25000,
        price_per_ride_along_lap: 6000,
        booking_type: "Direct Booking",
        accent: "oklch(0.58 0.22 28)",
        specs: JSON.stringify([
          { label: "0-100", value: "3.0s" },
          { label: "Power", value: "661 hp" },
          { label: "Top Speed", value: "330 km/h" },
        ]),
        sort_order: 3
      },
      {
        id: "mustang-gt",
        name: "Ford Mustang GT",
        brand: "Ford",
        image: "/cars/mustang-side.png",
        status: "comingsoon",
        price_per_lap: 10000,
        price_per_ride_along_lap: 2500,
        booking_type: "Coming Soon",
        accent: "oklch(0.5 0.13 255)",
        specs: JSON.stringify([
          { label: "0-100", value: "4.3s" },
          { label: "Power", value: "460 hp" },
          { label: "Top Speed", value: "250 km/h" },
        ]),
        sort_order: 4
      }
    ]

    for (const car of defaultCars) {
      await client.query(`
        INSERT INTO cars (id, name, brand, image, status, price_per_lap, price_per_ride_along_lap, booking_type, accent, specs, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [car.id, car.name, car.brand, car.image, car.status, car.price_per_lap, car.price_per_ride_along_lap, car.booking_type, car.accent, car.specs, car.sort_order])
    }

    console.log("Seeding Slot Settings...")
    const slots = [
      "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
      "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"
    ]
    for (let i = 0; i < slots.length; i++) {
      await client.query(`
        INSERT INTO slot_settings (slot, capacity, is_active, sort_order)
        VALUES ($1, 2, true, $2)
        ON CONFLICT (slot) DO NOTHING
      `, [slots[i], i + 1])
    }

    console.log("Seeding Email Templates...")
    await client.query(`
      INSERT INTO email_templates (key, name, description, subject, body, enabled, sort_order)
      VALUES 
        ('booking_confirmation', 'Booking Confirmation', 'Sent immediately after a drive booking is confirmed.', 'Your TurboRide Booking is Confirmed! (Ref: {{reference}})', 'Hi {{name}},\n\nYour TurboRide supercar drive is confirmed!\n\nBooking Reference: {{reference}}\nVehicle: {{car}}\nLaps: {{laps}}\nDate: {{date}}\nSlot: {{slot}}\nAmount Paid: ₹{{amountPaid}}\n\nVenue Location: {{location}}\nDriver Account: {{login}}\n\nSee you on the track!\nTeam TurboRide', true, 1),
        ('predrive_reminder', 'Pre-Drive Reminder', 'Sent 24 hours before the scheduled experience date.', 'Reminder: Your TurboRide Supercar Drive is Tomorrow!', 'Hi {{name}},\n\nGet ready! Your TurboRide experience is tomorrow.\n\nVehicle: {{car}}\nDate: {{date}}\nSlot: {{slot}}\nLocation: {{location}}\n\nPlease arrive 15 minutes before your slot with a valid driver license.\n\nTeam TurboRide', true, 2)
      ON CONFLICT (key) DO NOTHING
    `)

    console.log("Seeding Site Settings...")
    const defaultSettings = [
      ["bookings_paused", "false"],
      ["maintenance_message", "We are performing fleet maintenance. Bookings will reopen shortly."],
      ["lap_distance_km", "15"],
      ["lap_options", "1,2,3,4,5,6,7,8,9,10"],
      ["min_lead_days", "1"],
      ["discount_one_lap", "0.15"],
      ["reel_price", "1500"],
      ["gst_rate", "0.18"],
      ["location", "https://maps.app.goo.gl/KrwxNWrF446u2vEf8"],
      ["location_coords", "13.240241244983078, 77.27872189502081"],
      ["payment_gateway", "razorpay"],
      ["payment_simulation", "true"],
      ["email_simulation", "true"],
      ["smtp_host", "smtp.mailer91.com"],
      ["smtp_port", "587"],
      ["smtp_from_email", "hello@turboridesupercars.com"],
      ["smtp_from_name", "TurboRide Supercars"]
    ]

    for (const [k, v] of defaultSettings) {
      await client.query(`
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
      `, [k, v])
    }

    console.log("MIGRATION & SEEDING COMPLETED SUCCESSFULLY!")
  } catch (err) {
    console.error("Migration Error:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
