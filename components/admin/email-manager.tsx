"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, MailCheck, MailX, Send, Loader2, Info } from "lucide-react"
import type { EmailTemplate } from "@/lib/turboride/email-templates"
import { saveEmailTemplate, toggleEmailTemplate, sendEmailBlast } from "@/app/actions/admin-emails"

export function EmailManager({
  templates,
  mergeTags,
  providerConnected,
}: {
  templates: EmailTemplate[]
  mergeTags: Record<string, string[]>
  providerConnected: boolean
}) {
  const [items, setItems] = useState(templates)
  const [activeKey, setActiveKey] = useState(templates[0]?.key ?? "")
  const active = items.find((t) => t.key === activeKey) ?? items[0]

  const [subject, setSubject] = useState(active?.subject ?? "")
  const [body, setBody] = useState(active?.body ?? "")
  const [dirtyKey, setDirtyKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function selectTemplate(key: string) {
    const t = items.find((i) => i.key === key)
    if (!t) return
    setActiveKey(key)
    setSubject(t.subject)
    setBody(t.body)
    setDirtyKey(null)
  }

  function save() {
    startTransition(async () => {
      const res = await saveEmailTemplate({ key: active.key, subject, body })
      if (res.ok) {
        setItems((prev) =>
          prev.map((t) => (t.key === active.key ? { ...t, subject, body } : t)),
        )
        setDirtyKey(null)
        toast.success("Template saved.")
      } else {
        toast.error(res.error ?? "Could not save template.")
      }
    })
  }

  function toggle(key: string, enabled: boolean) {
    setItems((prev) => prev.map((t) => (t.key === key ? { ...t, enabled } : t)))
    startTransition(async () => {
      const res = await toggleEmailTemplate(key, enabled)
      if (!res.ok) {
        setItems((prev) => prev.map((t) => (t.key === key ? { ...t, enabled: !enabled } : t)))
        toast.error(res.error ?? "Could not update.")
      } else {
        toast.success(enabled ? "Email enabled." : "Email paused.")
      }
    })
  }

  function blast() {
    startTransition(async () => {
      const res = await sendEmailBlast(active.key)
      if (res.ok) {
        toast.success(
          res.simulated
            ? `Simulated: would send to ${res.recipients} recipient${res.recipients === 1 ? "" : "s"} (turn off email simulation in Settings and configure MSG91 SMTP to send for real).`
            : `Sent to ${res.sent} of ${res.recipients} recipient${res.recipients === 1 ? "" : "s"}.`,
        )
      } else {
        toast.error(res.error ?? "Could not send blast.")
      }
    })
  }

  function insertTag(tag: string) {
    setBody((b) => `${b}{{${tag}}}`)
    setDirtyKey(active.key)
  }

  if (!active) {
    return <p className="text-sm text-muted-foreground">No templates configured.</p>
  }

  const tags = mergeTags[active.key] ?? []
  const isDirty = dirtyKey === active.key

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Template list */}
      <div className="flex flex-col gap-2">
        {items.map((t) => {
          const selected = t.key === active.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTemplate(t.key)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-muted-foreground/40"
              }`}
            >
              <Mail
                className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                  {t.enabled ? (
                    <MailCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <MailX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {t.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Editor */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{active.name}</h2>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {active.enabled ? "Active" : "Paused"}
            </span>
            <span className="relative inline-flex">
              <input
                type="checkbox"
                role="switch"
                aria-label={`Toggle ${active.name}`}
                checked={active.enabled}
                onChange={(e) => toggle(active.key, e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tpl-subject">Subject line</Label>
          <Input
            id="tpl-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              setDirtyKey(active.key)
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tpl-body">Email body</Label>
          <textarea
            id="tpl-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setDirtyKey(active.key)
            }}
            rows={12}
            className="w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {tags.length > 0 && (
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Merge tags (click to insert)
            </span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {`{{${tag}}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {!providerConnected && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-muted p-3 text-xs text-warning-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-pretty">
              No email provider is connected, so these emails are saved as drafts and not delivered.
              Connect Resend or SendGrid to activate real sending.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={blast} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send blast now
          </Button>
          <Button type="button" onClick={save} disabled={pending || !isDirty}>
            {pending && isDirty ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save template"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
