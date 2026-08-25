/** Shared types for the payment gateway abstraction (PhonePe v2 + Razorpay). */

export type GatewayName = "phonepe" | "razorpay"

/** Normalised payment state across gateways. */
export type PaymentState = "paid" | "pending" | "failed"

/** Resolved, ready-to-use config for the currently active gateway. */
export type ActiveGatewayConfig =
  | {
      gateway: "phonepe"
      mode: "test" | "live"
      clientId: string
      clientSecret: string
      clientVersion: string
    }
  | {
      gateway: "razorpay"
      mode: "test" | "live"
      keyId: string
      keySecret: string
    }

/** Result of kicking off a hosted payment: where to send the customer's browser. */
export type InitiateResult =
  | { ok: true; redirectUrl: string; orderId: string }
  | { ok: false; error: string }

/** Result of a server-to-server status verification. */
export type VerifyResult = {
  state: PaymentState
  /** Amount confirmed captured, in paise (0 when unknown/unpaid). */
  amountPaise: number
  /** Gateway's own transaction/order id, when available. */
  gatewayOrderId?: string
}
