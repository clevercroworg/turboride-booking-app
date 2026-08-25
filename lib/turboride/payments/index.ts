import "server-only"
import { headers } from "next/headers"
import { getSettings } from "@/lib/turboride/settings"
import { phonepeCreatePayment, phonepeVerify } from "./phonepe"
import { razorpayCreatePayment, razorpayVerify } from "./razorpay"
import type { GatewayName, InitiateResult, VerifyResult } from "./types"

export type { GatewayName, InitiateResult, VerifyResult } from "./types"

/** Best-effort absolute origin of the running app, for callback/redirect URLs. */
export async function getOrigin(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
      const proto = h.get("x-forwarded-proto") ?? "https"
      return `${proto}://${host}`
    }
  } catch {
    // fallback
  }
  return process.env.NEXT_PUBLIC_APP_URL || "https://bookingapp-turboride.vercel.app"
}

/** Whether the given gateway has the credentials it needs to run live. */
function isConfigured(gateway: GatewayName, s: Awaited<ReturnType<typeof getSettings>>): boolean {
  if (gateway === "phonepe") return !!(s.phonepeClientId && s.phonepeClientSecret)
  return !!(s.razorpayKeyId && s.razorpayKeySecret)
}

export type PaymentRuntime = {
  /** True when no real gateway should be called (preview/demo or missing credentials). */
  simulate: boolean
  gateway: GatewayName
}

/**
 * Decide how a payment should be processed right now: real gateway or simulation.
 * Simulation wins if the admin toggled it on OR the active gateway lacks credentials,
 * so the preview and un-configured deployments never hit a dead end.
 */
export async function getPaymentRuntime(): Promise<PaymentRuntime> {
  const s = await getSettings()
  const gateway = s.paymentGateway
  const simulate = s.paymentSimulation || !isConfigured(gateway, s)
  return { simulate, gateway }
}

/** Kick off a hosted payment on the active gateway. Returns a browser redirect URL. */
export async function initiateGatewayPayment(args: {
  reference: string
  amountPaise: number
  contact: { name: string; email: string; phone: string }
  description?: string
}): Promise<InitiateResult & { gateway: GatewayName }> {
  const s = await getSettings()
  const gateway = s.paymentGateway
  const origin = await getOrigin()
  const callbackUrl = `${origin}/book/callback?ref=${encodeURIComponent(args.reference)}`

  if (gateway === "phonepe") {
    const res = await phonepeCreatePayment(
      {
        mode: s.phonepeMode,
        clientId: s.phonepeClientId,
        clientSecret: s.phonepeClientSecret,
        clientVersion: s.phonepeClientVersion,
      },
      {
        merchantOrderId: args.reference,
        amountPaise: args.amountPaise,
        redirectUrl: callbackUrl,
        contact: args.contact,
        message: args.description,
      },
    )
    return { ...res, gateway }
  }

  const res = await razorpayCreatePayment(
    { mode: s.razorpayMode, keyId: s.razorpayKeyId, keySecret: s.razorpayKeySecret },
    {
      reference: args.reference,
      amountPaise: args.amountPaise,
      callbackUrl,
      customer: args.contact,
      description: args.description,
    },
  )
  return { ...res, gateway }
}

/**
 * Verify a payment server-to-server. `gateway` is the one the booking was created with
 * (stored on the booking), and `gatewayOrderId` is the id we saved at initiation time.
 */
export async function verifyGatewayPayment(args: {
  gateway: GatewayName
  gatewayOrderId: string
}): Promise<VerifyResult> {
  const s = await getSettings()
  if (args.gateway === "phonepe") {
    return phonepeVerify(
      {
        mode: s.phonepeMode,
        clientId: s.phonepeClientId,
        clientSecret: s.phonepeClientSecret,
        clientVersion: s.phonepeClientVersion,
      },
      args.gatewayOrderId,
    )
  }
  return razorpayVerify(
    { mode: s.razorpayMode, keyId: s.razorpayKeyId, keySecret: s.razorpayKeySecret },
    args.gatewayOrderId,
  )
}
