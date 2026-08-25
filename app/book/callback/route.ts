import { NextResponse, type NextRequest } from "next/server"
import { settleBookingPayment } from "@/app/actions/booking"

/**
 * Return URL the gateway sends the customer's browser to after they finish (or abandon)
 * a payment. We do NOT trust any status in the query string — we re-verify server-to-server
 * via settleBookingPayment, then route the customer to the right place.
 *
 * PhonePe hits this as a GET; Razorpay Payment Links redirect here as a GET too, so we
 * handle both with a single GET handler.
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")
  const origin = req.nextUrl.origin

  if (!ref) {
    return NextResponse.redirect(`${origin}/book?payment=error`)
  }

  try {
    const result = await settleBookingPayment(ref)
    if (result.ok && (result.status === "confirmed" || result.status === "scheduled")) {
      // Paid — show the confirmation for this booking.
      return NextResponse.redirect(`${origin}/book/confirmation/${encodeURIComponent(ref)}`)
    }
    if (result.status === "pending") {
      // Gateway hasn't confirmed yet; the webhook will finish it. Tell the customer.
      return NextResponse.redirect(`${origin}/book/confirmation/${encodeURIComponent(ref)}?status=pending`)
    }
    // Failed/cancelled.
    return NextResponse.redirect(`${origin}/book?payment=failed&ref=${encodeURIComponent(ref)}`)
  } catch (err) {
    console.error("[v0] Payment callback failed:", err)
    return NextResponse.redirect(`${origin}/book?payment=error`)
  }
}

// Some gateways may POST the return; treat it identically.
export async function POST(req: NextRequest) {
  return GET(req)
}
