"use server"

import { pool } from "@/lib/db"
import { getAdmin } from "@/lib/turboride/admin-auth"
import { revalidatePath } from "next/cache"
import { sendEmailBatch } from "@/lib/turboride/email"
import { getSettings } from "@/lib/turboride/settings"
import { getOrigin } from "@/lib/turboride/payments"
import { renderMergeTags } from "@/lib/turboride/email-templates"

async function requireAdmin() {
  return getAdmin()
}

/** Save a template's subject, body, and description. Admin-only. */
export async function saveEmailTemplate(input: {
  key: string
  subject: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, error: "Not authorized." }

  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject) return { ok: false, error: "Subject is required." }
  if (!body) return { ok: false, error: "Body is required." }

  const res = await pool.query(
    `UPDATE email_templates SET subject = $2, body = $3, updated_at = now() WHERE key = $1`,
    [input.key, subject, body],
  )
  if (res.rowCount === 0) return { ok: false, error: "Template not found." }
  revalidatePath("/admin/emails")
  return { ok: true }
}

/** Enable/disable an automated email. Admin-only. */
export async function toggleEmailTemplate(
  key: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, error: "Not authorized." }

  await pool.query(`UPDATE email_templates SET enabled = $2, updated_at = now() WHERE key = $1`, [
    key,
    enabled,
  ])
  revalidatePath("/admin/emails")
  return { ok: true }
}

/**
 * Send a template as a blast to everyone who has booked (distinct email). Sends over
 * MSG91 SMTP with per-recipient merge tags. When email simulation is on (or SMTP isn't
 * configured), the send is counted but not delivered — reported via `simulated`.
 */
export async function sendEmailBlast(
  key: string,
): Promise<{
  ok: boolean
  error?: string
  recipients?: number
  sent?: number
  simulated?: boolean
}> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, error: "Not authorized." }

  const tpl = await pool.query(`SELECT subject, body FROM email_templates WHERE key = $1`, [key])
  const template = tpl.rows[0]
  if (!template) return { ok: false, error: "Template not found." }

  // Audience: the most recent name per distinct email of anyone who has booked.
  const res = await pool.query(
    `SELECT DISTINCT ON (customer_email) customer_email AS email, customer_name AS name
     FROM bookings
     WHERE customer_email <> ''
     ORDER BY customer_email, created_at DESC`,
  )
  const audience = res.rows as { email: string; name: string }[]
  if (audience.length === 0) return { ok: true, recipients: 0, sent: 0, simulated: true }

  const settings = await getSettings()
  const origin = await getOrigin()

  // Merge-tag values available for a (non-booking-specific) blast. Booking-only tags
  // resolve to blank so stray placeholders don't leak raw {{tags}} into the email.
  const valuesFor = (r: { email: string; name: string }): Record<string, string> => ({
    name: r.name || "Driver",
    car: "",
    reference: "",
    laps: "",
    date: "",
    slot: "",
    amountPaid: "",
    balance: "",
    location: settings.location,
    login: `${origin}/account`,
  })

  const byEmail = new Map(audience.map((r) => [r.email, r]))
  const result = await sendEmailBatch(
    audience.map((r) => r.email),
    (to) => renderMergeTags(template.subject, valuesFor(byEmail.get(to)!)),
    (to) => renderMergeTags(template.body, valuesFor(byEmail.get(to)!)),
  )

  return {
    ok: true,
    recipients: audience.length,
    sent: result.sent,
    // Simulated when nothing was actually delivered (simulation on / SMTP unconfigured).
    simulated: result.sent === 0,
  }
}
