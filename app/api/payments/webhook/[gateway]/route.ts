import { NextResponse, type NextRequest } from "next/server"
import { settleBookingPayment } from "@/app/actions/booking"

/**
 * Gateway webhook receiver. This is a SAFETY NET, not the source of truth: our normal
 * flow settles a booking on the browser callback. But if the customer closes the tab
 * before the redirect, the webhook still finalises the booking.
 *
 * We never trust amounts/status from the webhook body. We only extract the booking
 * reference, then call settleBookingPayment, which re-verifies server-to-server against
 * the gateway's status API (authoritative) before touching the booking.
 *
 * Because verification is authoritative, we accept the webhook without a shared secret;
 * a forged webhook can at most trigger a re-verification that will fail for unpaid orders.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const reference = extractReference(gateway, payload)
  if (!reference) {
    // Nothing actionable — ack so the gateway doesn't keep retrying.
    console.log("[v0] Webhook received with no resolvable reference:", gateway)
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const result = await settleBookingPayment(reference)
    return NextResponse.json({ ok: result.ok, status: result.status })
  } catch (err) {
    console.error("[v0] Webhook settle failed:", err)
    // 200 so the gateway doesn't hammer retries; the callback/next webhook can recover.
    return NextResponse.json({ ok: false })
  }
}

/** Pull the booking reference out of each gateway's webhook shape. */
function extractReference(gateway: string, payload: unknown): string | null {
  const p = payload as Record<string, any>
  try {
    if (gateway === "phonepe") {
      // 1. PhonePe v1 base64 encoded callback
      if (typeof p?.response === "string") {
        try {
          const decoded = JSON.parse(Buffer.from(p.response, "base64").toString("utf-8"))
          if (decoded?.data?.merchantTransactionId) return decoded.data.merchantTransactionId
        } catch {
          // ignore json parse error
        }
      }
      // 2. PhonePe direct / v2 structure
      return p?.data?.merchantTransactionId ?? p?.payload?.merchantOrderId ?? p?.merchantOrderId ?? p?.merchantTransactionId ?? null
    }
    if (gateway === "razorpay") {
      // Payment Link webhook: entity nested under payload.payment_link.entity
      const link = p?.payload?.payment_link?.entity
      return link?.reference_id ?? link?.notes?.reference ?? null
    }
  } catch {
    return null
  }
  return null
}
