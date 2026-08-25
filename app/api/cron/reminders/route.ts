import { NextRequest, NextResponse } from "next/server"
import { processPendingPreDriveReminders } from "@/lib/turboride/email/booking-emails"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Automated Cron Job Endpoint for 24-Hour Pre-Drive Reminders.
 *
 * Triggered automatically by Vercel Cron or can be triggered manually by the admin.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // If CRON_SECRET is set in Vercel, verify it (Vercel automatically sends Bearer <CRON_SECRET>)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 })
    }

    const result = await processPendingPreDriveReminders()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      sent: result.sent,
      skipped: result.skipped,
      message: `Successfully processed pre-drive reminders (${result.sent} sent, ${result.skipped} skipped)`,
    })
  } catch (error) {
    console.error("[Cron Reminders API Error]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Cron processing failed" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
