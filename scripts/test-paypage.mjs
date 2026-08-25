import crypto from "crypto"

const merchantId = "TURBORIDEONLINE"
const saltKey = "cb86e2c0-fe66-41dd-8b74-53f47a6ec43a"
const saltIndex = "1"

async function testPayPage() {
  const txnId = "TRB_TEST_" + Date.now()
  const payload = {
    merchantId,
    merchantTransactionId: txnId,
    merchantUserId: "CUST_TEST01",
    amount: 10000, // Rs 100.00
    redirectUrl: "https://book.turboridesupercars.com/book/confirmation/" + txnId,
    redirectMode: "REDIRECT",
    callbackUrl: "https://book.turboridesupercars.com/api/webhooks/phonepe",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
    message: "TurboRide Supercar Booking Verification",
  }

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64")
  const stringToSign = `${base64Payload}/pg/v1/pay${saltKey}`
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex")
  const xVerify = `${sha256}###${saltIndex}`

  const res = await fetch("https://api.phonepe.com/apis/hermes/pg/v1/pay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
    },
    body: JSON.stringify({ request: base64Payload }),
  })

  const json = await res.json()
  console.log("PhonePe Live Status Code:", res.status)
  console.log("PhonePe Live Response:", JSON.stringify(json, null, 2))
}

testPayPage().catch(console.error)
