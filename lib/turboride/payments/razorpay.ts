import "server-only"
import type { InitiateResult, PaymentState, VerifyResult } from "./types"

/**
 * Razorpay client using Payment Links, so the checkout UX matches PhonePe's hosted
 * redirect: create a link → send the customer to `short_url` → they pay on Razorpay →
 * Razorpay redirects back to our callback. We verify the final result server-to-server
 * by fetching the payment link status (authoritative), so no webhook secret is needed.
 *
 * Docs: https://razorpay.com/docs/api/payments/payment-links/
 */

export type RazorpayConfig = {
  mode: "test" | "live"
  keyId: string
  keySecret: string
}

const API = "https://api.razorpay.com/v1"

function authHeader(cfg: RazorpayConfig): string {
  return "Basic " + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")
}

/** Create a Razorpay Payment Link and return its short URL for redirect. */
export async function razorpayCreatePayment(
  cfg: RazorpayConfig,
  args: {
    reference: string
    amountPaise: number
    callbackUrl: string
    customer: { name: string; email: string; phone: string }
    description?: string
  },
): Promise<InitiateResult> {
  try {
    const res = await fetch(`${API}/payment_links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(cfg),
      },
      body: JSON.stringify({
        amount: args.amountPaise,
        currency: "INR",
        accept_partial: false,
        reference_id: args.reference,
        description: args.description ?? "TurboRide booking",
        customer: {
          name: args.customer.name,
          email: args.customer.email,
          contact: args.customer.phone,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        callback_url: args.callbackUrl,
        callback_method: "get",
        notes: { reference: args.reference },
      }),
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as {
      id?: string
      short_url?: string
      error?: { description?: string }
    }
    if (!res.ok || !json.short_url || !json.id) {
      return { ok: false, error: json.error?.description || `Razorpay create-link failed (${res.status})` }
    }
    return { ok: true, redirectUrl: json.short_url, orderId: json.id }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

function mapState(status: string | undefined): PaymentState {
  if (status === "paid") return "paid"
  if (status === "cancelled" || status === "expired") return "failed"
  return "pending"
}

/** Authoritative status check: fetch the payment link and read its status. */
export async function razorpayVerify(cfg: RazorpayConfig, paymentLinkId: string): Promise<VerifyResult> {
  const res = await fetch(`${API}/payment_links/${encodeURIComponent(paymentLinkId)}`, {
    method: "GET",
    headers: { Authorization: authHeader(cfg) },
    cache: "no-store",
  })
  if (!res.ok) return { state: "pending", amountPaise: 0 }
  const json = (await res.json().catch(() => ({}))) as {
    status?: string
    amount_paid?: number
    id?: string
  }
  return {
    state: mapState(json.status),
    amountPaise: Number(json.amount_paid ?? 0),
    gatewayOrderId: json.id,
  }
}

/** Test Razorpay credentials by calling Razorpay API */
export async function razorpayTestConnection(cfg: RazorpayConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API}/payments?count=1`, {
      method: "GET",
      headers: { Authorization: authHeader(cfg) },
      cache: "no-store",
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } }
      return {
        ok: false,
        message: json.error?.description || `Razorpay auth failed with status ${res.status}`,
      }
    }
    return {
      ok: true,
      message: `Razorpay connection successful! Credentials are valid for ${cfg.mode} mode.`,
    }
  } catch (err) {
    return {
      ok: false,
      message: (err as Error).message,
    }
  }
}
