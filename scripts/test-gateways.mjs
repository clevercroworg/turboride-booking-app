import crypto from "crypto"
import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace(/([?&])sslmode=[^&]*(&|$)/, "$1").replace(/[?&]$/, ""),
  ssl: { rejectUnauthorized: false }
})

const phonepe = {
  clientId: "TURBORIDEONLINE",
  clientSecret: "cb86e2c0-fe66-41dd-8b74-53f47a6ec43a",
  clientVersion: "1",
}

const razorpay = {
  keyId: "rzp_test_TCAWA9fpwmR4GB",
  keySecret: "zYlnQpOhfiEGnYlr50a48vtA",
}

async function testPhonePe(mode) {
  console.log(`\n========================================`);
  console.log(`🔍 TESTING PHONEPE (${mode.toUpperCase()} MODE)`);
  console.log(`========================================`);

  // 1. v2 OAuth
  const v2AuthUrl = mode === "live"
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"

  try {
    const body = new URLSearchParams({
      client_id: phonepe.clientId,
      client_version: phonepe.clientVersion,
      client_secret: phonepe.clientSecret,
      grant_type: "client_credentials",
    })
    const res = await fetch(v2AuthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    const text = await res.text()
    console.log(`v2 OAuth Endpoint: ${v2AuthUrl}`)
    console.log(`Status: ${res.status}`)
    console.log(`Response: ${text.slice(0, 300)}`)
  } catch (err) {
    console.error("v2 OAuth Request Failed:", err.message)
  }

  // 2. v1 Checksum Ping
  const v1Base = mode === "live"
    ? "https://api.phonepe.com/apis/hermes"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox"

  const txnId = "PING_" + Date.now()
  const stringToSign = `/pg/v1/status/${phonepe.clientId}/${txnId}${phonepe.clientSecret}`
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex")
  const xVerify = `${sha256}###${phonepe.clientVersion}`

  try {
    const res = await fetch(`${v1Base}/pg/v1/status/${phonepe.clientId}/${txnId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
        "X-MERCHANT-ID": phonepe.clientId,
      },
    })
    const text = await res.text()
    console.log(`v1 Hermes Status Endpoint: ${v1Base}/pg/v1/status/...`)
    console.log(`Status: ${res.status}`)
    console.log(`Response: ${text.slice(0, 300)}`)
  } catch (err) {
    console.error("v1 Request Failed:", err.message)
  }
}

async function testRazorpay() {
  console.log(`\n========================================`);
  console.log(`🔍 TESTING RAZORPAY (TEST KEYS)`);
  console.log(`========================================`);

  const authHeader = "Basic " + Buffer.from(`${razorpay.keyId}:${razorpay.keySecret}`).toString("base64")
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: 10000,
        currency: "INR",
        receipt: "test_rcpt_" + Date.now(),
      }),
    })
    const json = await res.json()
    console.log(`Status: ${res.status}`)
    console.log(`Response:`, json)
  } catch (err) {
    console.error("Razorpay Error:", err.message)
  }
}

async function saveToDatabase() {
  console.log(`\n========================================`);
  console.log(`💾 SAVING CREDENTIALS TO NEON DATABASE`);
  console.log(`========================================`);

  const settings = [
    ["payment_gateway", "phonepe"],
    ["payment_simulation", "false"],
    ["phonepe_mode", "live"],
    ["phonepe_client_id", phonepe.clientId],
    ["phonepe_client_secret", phonepe.clientSecret],
    ["phonepe_client_version", phonepe.clientVersion],
    ["razorpay_mode", "test"],
    ["razorpay_key_id", razorpay.keyId],
    ["razorpay_key_secret", razorpay.keySecret],
  ]

  for (const [k, v] of settings) {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [k, v]
    )
  }
  console.log("All payment settings saved into Neon DB successfully!")
}

async function main() {
  await testPhonePe("live");
  await testPhonePe("test");
  await testRazorpay();
  await saveToDatabase();
  await pool.end();
}

main().catch(console.error)
