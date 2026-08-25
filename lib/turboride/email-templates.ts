import { pool } from "@/lib/db"

export type EmailTemplate = {
  key: string
  name: string
  description: string | null
  subject: string
  body: string
  enabled: boolean
  sortOrder: number
  updatedAt: string
}

function mapRow(r: Record<string, unknown>): EmailTemplate {
  return {
    key: r.key as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    subject: r.subject as string,
    body: r.body as string,
    enabled: Boolean(r.enabled),
    sortOrder: (r.sort_order as number) ?? 0,
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : "",
  }
}

// Retired pre-book campaign template. Its DB row is kept dormant but hidden from the
// admin so no pre-launch blast can be sent.
const RETIRED_TEMPLATE_KEYS = ["prelaunch_blast"]

/** All active email templates, ordered for the admin list. */
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const res = await pool.query(
    `SELECT key, name, description, subject, body, enabled, sort_order, updated_at
     FROM email_templates WHERE key <> ALL($1) ORDER BY sort_order`,
    [RETIRED_TEMPLATE_KEYS],
  )
  return res.rows.map(mapRow)
}

/** Substitute {{tag}} placeholders with values. Unknown tags are left untouched. */
export function renderMergeTags(text: string, values: Record<string, string | number | undefined | null>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, tag: string) => {
    const v = values[tag]
    return v === undefined || v === null ? match : String(v)
  })
}

/**
 * Render a stored (plain-text) template body into a minimal, safe HTML email.
 * Escapes HTML in the body, converts newlines to <br>, and linkifies bare URLs
 * (so {{location}}/{{login}} links are clickable) — then wraps it in a simple shell.
 */
export function renderEmailHtml(subject: string, body: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const linkify = (s: string) =>
    s.replace(
      /(https?:\/\/[^\s<]+)/g,
      (url) => `<a href="${url}" style="color:#e11d2a;text-decoration:underline;">${url}</a>`,
    )
  const htmlBody = linkify(escape(body)).replace(/\n/g, "<br>")
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background:#111111;padding:20px 28px;"><span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">TurboRide</span></td></tr>
<tr><td style="padding:28px;color:#1a1a1a;font-size:15px;line-height:1.6;">${htmlBody}</td></tr>
<tr><td style="padding:18px 28px;background:#fafafa;color:#888888;font-size:12px;line-height:1.5;border-top:1px solid #eee;">This is an automated message from TurboRide. Please do not reply to this email.</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

/** Merge tags available to each template, surfaced in the editor UI. */
export const MERGE_TAGS: Record<string, string[]> = {
  booking_confirmation: [
    "name",
    "car",
    "reference",
    "laps",
    "date",
    "slot",
    "amountPaid",
    "balance",
    "location",
    "login",
  ],
  predrive_reminder: ["name", "car", "date", "slot", "location", "login"],
}
