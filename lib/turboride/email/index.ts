import "server-only"
import nodemailer from "nodemailer"
import { getSettings } from "@/lib/turboride/settings"
import { renderEmailHtml } from "@/lib/turboride/email-templates"

export type SendEmailInput = {
  to: string
  subject: string
  /** Already-rendered plain-text body (merge tags substituted). Wrapped into HTML here. */
  body: string
}

export type SendEmailResult = { ok: boolean; simulated: boolean; error?: string }

/**
 * Send a single transactional email via MSG91 SMTP (nodemailer).
 *
 * Respects the admin "email simulation" toggle: when simulation is on, or SMTP
 * credentials are incomplete, nothing is sent — we log and report `simulated: true`
 * so callers (and the v0 preview) still succeed.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const s = await getSettings()

  const configured = Boolean(s.smtpHost && s.smtpUser && s.smtpPassword && s.smtpFromEmail)
  if (s.emailSimulation || !configured) {
    console.log("[TurboRide] Email simulated (not sent):", {
      to: input.to,
      subject: input.subject,
      reason: s.emailSimulation ? "simulation on" : "SMTP not configured",
    })
    return { ok: true, simulated: true }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: s.smtpHost,
      port: s.smtpPort,
      // 465 = implicit SSL; 587/others = STARTTLS.
      secure: s.smtpPort === 465,
      auth: { user: s.smtpUser, pass: s.smtpPassword },
    })

    await transporter.sendMail({
      from: s.smtpFromName ? `"${s.smtpFromName}" <${s.smtpFromEmail}>` : s.smtpFromEmail,
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: renderEmailHtml(input.subject, input.body),
    })
    return { ok: true, simulated: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error"
    console.log("[TurboRide] Email send failed:", message)
    return { ok: false, simulated: false, error: message }
  }
}

/**
 * Send the same email to many recipients, sequentially (small audiences, keeps SMTP
 * within rate limits). Returns how many were delivered vs simulated.
 */
export async function sendEmailBatch(
  recipients: string[],
  subjectFor: (to: string) => string,
  bodyFor: (to: string) => string,
): Promise<{ sent: number; simulated: number; failed: number }> {
  let sent = 0
  let simulated = 0
  let failed = 0
  for (const to of recipients) {
    const res = await sendEmail({ to, subject: subjectFor(to), body: bodyFor(to) })
    if (!res.ok) failed++
    else if (res.simulated) simulated++
    else sent++
  }
  return { sent, simulated, failed }
}

/** Test MSG91 SMTP configuration by sending a verification email */
export async function testSmtpConnection(
  testRecipient: string,
  config?: {
    host: string
    port: number
    user: string
    password: string
    fromEmail: string
    fromName: string
  },
): Promise<{ ok: boolean; message: string }> {
  try {
    const s = await (async () => {
      if (config) {
        return {
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
        }
      }
      const settings = await getSettings()
      return {
        host: settings.smtpHost,
        port: settings.smtpPort,
        user: settings.smtpUser,
        password: settings.smtpPassword,
        fromEmail: settings.smtpFromEmail,
        fromName: settings.smtpFromName,
      }
    })()

    if (!s.host || !s.user || !s.password || !s.fromEmail) {
      return { ok: false, message: "Missing SMTP configuration fields. Fill in host, user, password, and sender email." }
    }

    const transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      auth: { user: s.user, pass: s.password },
    })

    // Verify SMTP connection handshake
    await transporter.verify()

    // Dispatch a test email if recipient provided
    if (testRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) {
      await transporter.sendMail({
        from: s.fromName ? `"${s.fromName}" <${s.fromEmail}>` : s.fromEmail,
        to: testRecipient,
        subject: "TurboRide MSG91 SMTP Test Email",
        text: "Your MSG91 SMTP configuration is working perfectly for TurboRide Supercars booking platform!",
        html: renderEmailHtml(
          "SMTP Test Successful",
          "Your MSG91 SMTP configuration is verified and working perfectly for **TurboRide Supercars** booking platform.\n\nSender: " +
            s.fromEmail +
            "\nHost: " +
            s.host +
            ":" +
            s.port,
        ),
      })
      return {
        ok: true,
        message: `SMTP handshake verified and test email successfully delivered to ${testRecipient}!`,
      }
    }

    return {
      ok: true,
      message: `SMTP connection handshake with ${s.host}:${s.port} verified successfully!`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP connection failed"
    return { ok: false, message: msg }
  }
}
