import "server-only"
import crypto from "crypto"
import type { InitiateResult, PaymentState, VerifyResult } from "./types"

/**
 * PhonePe payment client with dual support for:
 * 1. PhonePe Standard Checkout v2 (OAuth 2.0 Client Credentials)
 * 2. PhonePe PG v1 (Merchant ID + Salt Key + Salt Index SHA-256 Checksum)
 *
 * Docs v2: https://developer.phonepe.com (Website Integration → Standard Checkout v2)
 * Docs v1: https://developer.phonepe.com (PG Checkout v1 / Standard PayPage)
 */

export type PhonePeConfig = {
  mode: "test" | "live"
  clientId: string
  clientSecret: string
  clientVersion: string
}

/** Check whether the credentials look like PhonePe v1 (Merchant ID + Salt Key UUID) vs v2 OAuth */
function isPhonePeV1(cfg: PhonePeConfig): boolean {
  const secret = cfg.clientSecret.trim()
  // PhonePe v1 salt keys are strictly 32-36 hex char UUIDs with dashes
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secret)
}

/** Base URLs for v2 (OAuth) and v1 (SHA256 PG) */
function getEndpointsV2(mode: "test" | "live") {
  if (mode === "live") {
    return {
      auth: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
      pay: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
      status: (orderId: string) =>
        `https://api.phonepe.com/apis/pg/checkout/v2/order/${encodeURIComponent(orderId)}/status`,
    }
  }
  const base = "https://api-preprod.phonepe.com/apis/pg-sandbox"
  return {
    auth: `${base}/v1/oauth/token`,
    pay: `${base}/checkout/v2/pay`,
    status: (orderId: string) => `${base}/checkout/v2/order/${encodeURIComponent(orderId)}/status`,
  }
}

function getEndpointsV1(mode: "test" | "live") {
  if (mode === "live") {
    const base = "https://api.phonepe.com/apis/hermes"
    return {
      pay: `${base}/pg/v1/pay`,
      status: (merchantId: string, txnId: string) =>
        `${base}/pg/v1/status/${encodeURIComponent(merchantId)}/${encodeURIComponent(txnId)}`,
    }
  }
  const base = "https://api-preprod.phonepe.com/apis/pg-sandbox"
  return {
    pay: `${base}/pg/v1/pay`,
    status: (merchantId: string, txnId: string) =>
      `${base}/pg/v1/status/${encodeURIComponent(merchantId)}/${encodeURIComponent(txnId)}`,
  }
}

/** In-memory access-token cache for v2 OAuth */
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAuthTokenV2(cfg: PhonePeConfig): Promise<string> {
  const cacheKey = `${cfg.mode}:${cfg.clientId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token

  const { auth } = getEndpointsV2(cfg.mode)
  const body = new URLSearchParams({
    client_id: cfg.clientId.trim(),
    client_version: cfg.clientVersion?.trim() || "1",
    client_secret: cfg.clientSecret.trim(),
    grant_type: "client_credentials",
  })

  const res = await fetch(auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`PhonePe OAuth auth failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as { access_token?: string; expires_at?: number }
  if (!json.access_token) throw new Error("PhonePe auth returned no access_token")

  const expiresAt = json.expires_at ? json.expires_at * 1000 : Date.now() + 30 * 60_000
  tokenCache.set(cacheKey, { token: json.access_token, expiresAt })
  return json.access_token
}

/** Initiate payment using PhonePe v1 (SHA256 checksum) */
async function phonepeCreatePaymentV1(
  cfg: PhonePeConfig,
  args: {
    merchantOrderId: string
    amountPaise: number
    redirectUrl: string
    contact?: { name?: string; email?: string; phone?: string }
    message?: string
  },
): Promise<InitiateResult> {
  const merchantId = cfg.clientId.trim()
  const saltKey = cfg.clientSecret.trim()
  const saltIndex = cfg.clientVersion?.trim() || "1"
  const { pay } = getEndpointsV1(cfg.mode)

  const cleanPhone = (args.contact?.phone || "").replace(/\D/g, "").slice(-10)
  const isLocal = args.redirectUrl.includes("localhost") || args.redirectUrl.includes("127.0.0.1")
  const prodCallbackUrl = `https://book.turboridesupercars.com/api/payments/webhook/phonepe`

  const payload: Record<string, any> = {
    merchantId,
    merchantTransactionId: args.merchantOrderId,
    merchantUserId: `CUST_${args.merchantOrderId.replace(/\W/g, "").slice(-10)}`,
    amount: args.amountPaise,
    redirectUrl: args.redirectUrl,
    redirectMode: "REDIRECT",
    callbackUrl: isLocal ? prodCallbackUrl : `${args.redirectUrl.split("/book/")[0]}/api/payments/webhook/phonepe`,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
    message: args.message ?? "TurboRide Supercar Booking",
  }

  if (cleanPhone && cleanPhone.length === 10) {
    payload.mobileNumber = cleanPhone
  }

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64")
  const stringToSign = `${base64Payload}/pg/v1/pay${saltKey}`
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex")
  const xVerify = `${sha256}###${saltIndex}`

  const res = await fetch(pay, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
    },
    body: JSON.stringify({ request: base64Payload }),
    cache: "no-store",
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    code?: string
    message?: string
    data?: {
      instrumentResponse?: {
        redirectInfo?: {
          url?: string
        }
      }
    }
  }

  const redirectUrl = json.data?.instrumentResponse?.redirectInfo?.url
  if (!res.ok || !json.success || !redirectUrl) {
    const err = json.message || json.code || `PhonePe v1 payment initiation failed (${res.status})`
    return { ok: false, error: err }
  }

  return { ok: true, redirectUrl, orderId: args.merchantOrderId }
}

/** Initiate payment using PhonePe v2 (OAuth) */
async function phonepeCreatePaymentV2(
  cfg: PhonePeConfig,
  args: { merchantOrderId: string; amountPaise: number; redirectUrl: string; message?: string },
): Promise<InitiateResult> {
  const token = await getAuthTokenV2(cfg)
  const { pay } = getEndpointsV2(cfg.mode)
  const res = await fetch(pay, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${token}`,
    },
    body: JSON.stringify({
      merchantOrderId: args.merchantOrderId,
      amount: args.amountPaise,
      expireAfter: 1200,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: args.message ?? "TurboRide booking",
        merchantUrls: { redirectUrl: args.redirectUrl },
      },
    }),
    cache: "no-store",
  })
  const json = (await res.json().catch(() => ({}))) as { redirectUrl?: string; orderId?: string; message?: string }
  if (!res.ok || !json.redirectUrl) {
    return { ok: false, error: json.message || `PhonePe v2 create-payment failed (${res.status})` }
  }
  return { ok: true, redirectUrl: json.redirectUrl, orderId: json.orderId ?? args.merchantOrderId }
}

/** Master create payment handler with smart auto-fallback */
export async function phonepeCreatePayment(
  cfg: PhonePeConfig,
  args: {
    merchantOrderId: string
    amountPaise: number
    redirectUrl: string
    contact?: { name?: string; email?: string; phone?: string }
    message?: string
  },
): Promise<InitiateResult> {
  try {
    if (isPhonePeV1(cfg)) {
      try {
        const v1Result = await phonepeCreatePaymentV1(cfg, args)
        if (v1Result.ok) return v1Result
      } catch {
        // Fall back to v2 if v1 throws
      }
    }
    return await phonepeCreatePaymentV2(cfg, args)
  } catch (err) {
    // If v2 failed with 401, try v1 once
    if (!isPhonePeV1(cfg)) {
      try {
        const v1Result = await phonepeCreatePaymentV1(cfg, args)
        if (v1Result.ok) return v1Result
      } catch {
        // preserve original error
      }
    }
    return { ok: false, error: (err as Error).message }
  }
}

/** Map PhonePe state */
function mapState(state: string | undefined): PaymentState {
  if (state === "COMPLETED" || state === "PAYMENT_SUCCESS") return "paid"
  if (state === "FAILED" || state === "PAYMENT_ERROR") return "failed"
  return "pending"
}

/** Verify payment status for PhonePe v1 (SHA256) */
async function phonepeVerifyV1(cfg: PhonePeConfig, merchantOrderId: string): Promise<VerifyResult> {
  const merchantId = cfg.clientId.trim()
  const saltKey = cfg.clientSecret.trim()
  const saltIndex = cfg.clientVersion?.trim() || "1"
  const { status } = getEndpointsV1(cfg.mode)

  const stringToSign = `/pg/v1/status/${merchantId}/${merchantOrderId}${saltKey}`
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex")
  const xVerify = `${sha256}###${saltIndex}`

  const res = await fetch(status(merchantId, merchantOrderId), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
      "X-MERCHANT-ID": merchantId,
    },
    cache: "no-store",
  })

  if (!res.ok) return { state: "pending", amountPaise: 0 }
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    code?: string
    data?: {
      state?: string
      responseCode?: string
      amount?: number
    }
  }

  const state = json.data?.state || json.code
  return {
    state: mapState(state),
    amountPaise: Number(json.data?.amount ?? 0),
    gatewayOrderId: merchantOrderId,
  }
}

/** Verify payment status for PhonePe v2 (OAuth) */
async function phonepeVerifyV2(cfg: PhonePeConfig, merchantOrderId: string): Promise<VerifyResult> {
  const token = await getAuthTokenV2(cfg)
  const { status } = getEndpointsV2(cfg.mode)
  const res = await fetch(status(merchantOrderId), {
    method: "GET",
    headers: { Authorization: `O-Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return { state: "pending", amountPaise: 0 }
  const json = (await res.json().catch(() => ({}))) as { state?: string; amount?: number; orderId?: string }
  return {
    state: mapState(json.state),
    amountPaise: Number(json.amount ?? 0),
    gatewayOrderId: json.orderId,
  }
}

/** Server-to-server verification */
export async function phonepeVerify(cfg: PhonePeConfig, merchantOrderId: string): Promise<VerifyResult> {
  try {
    if (isPhonePeV1(cfg)) {
      const v1Res = await phonepeVerifyV1(cfg, merchantOrderId)
      if (v1Res.state !== "pending") return v1Res
      return await phonepeVerifyV2(cfg, merchantOrderId)
    }
    const v2Res = await phonepeVerifyV2(cfg, merchantOrderId)
    if (v2Res.state !== "pending") return v2Res
    return await phonepeVerifyV1(cfg, merchantOrderId)
  } catch {
    try {
      if (isPhonePeV1(cfg)) {
        return await phonepeVerifyV2(cfg, merchantOrderId)
      }
      return await phonepeVerifyV1(cfg, merchantOrderId)
    } catch {
      return { state: "pending", amountPaise: 0 }
    }
  }
}

/** Test PhonePe credentials connection */
export async function phonepeTestConnection(cfg: PhonePeConfig): Promise<{ ok: boolean; message: string }> {
  try {
    if (isPhonePeV1(cfg)) {
      const res = await phonepeVerifyV1(cfg, "TEST_PING")
      return {
        ok: true,
        message: `PhonePe v1 (Checksum) API reached successfully. Mode: ${cfg.mode}. Test status: ${res.state}`,
      }
    }
    const token = await getAuthTokenV2(cfg)
    return {
      ok: true,
      message: `PhonePe v2 (OAuth) token generated successfully! Mode: ${cfg.mode}`,
    }
  } catch (err) {
    return {
      ok: false,
      message: (err as Error).message,
    }
  }
}
