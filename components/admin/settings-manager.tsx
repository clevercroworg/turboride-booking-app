"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateGlobalSettings,
  updatePaymentConfig,
  updateEmailConfig,
  updateAdminProfile,
  changeAdminPassword,
  testPaymentGatewayAction,
  testEmailDeliveryAction,
} from "@/app/actions/admin-settings"
import type { SiteSettings } from "@/lib/turboride/settings"
import { formatINR } from "@/lib/turboride/fleet"
import { Power, CreditCard, Mail, UserCog, Eye, EyeOff, Loader2, Check, ChevronDown, RefreshCw, Send } from "lucide-react"

type Props = {
  settings: SiteSettings
  admin: { name: string; email: string }
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Power
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

/** All selectable lap counts an admin can offer to customers. */
const ALL_LAPS = Array.from({ length: 30 }, (_, i) => i + 1)

/** Dropdown multi-select of lap counts (1–30) with a checkmark on each chosen value. */
function LapOptionsPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (v: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const selected = [...value].sort((a, b) => a - b)

  function toggle(n: number) {
    if (value.includes(n)) onChange(value.filter((v) => v !== n))
    else onChange([...value, n].sort((a, b) => a - b))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <span className="truncate">
          {selected.length === 0 ? "Select lap options" : `${selected.length} selected · ${selected.join(", ")}`}
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => onChange(ALL_LAPS)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-muted-foreground hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="grid max-h-56 grid-cols-5 gap-1 overflow-y-auto">
            {ALL_LAPS.map((n) => {
              const on = value.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(n)}
                  className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-sm tabular-nums transition-colors ${
                    on
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {on && <Check className="h-3 w-3" />}
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function SettingsManager({ settings, admin }: Props) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="grid gap-5 lg:h-fit">
        <GlobalControls settings={settings} />
        <AdminProfile admin={admin} />
      </div>
      <div className="grid gap-5 lg:h-fit">
        <PaymentGatewayConfig settings={settings} />
        <EmailConfig settings={settings} />
      </div>
    </div>
  )
}

/** A small reusable toggle row used by the payment/email cards. */
function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground text-pretty">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

/** A labelled two-option segmented control (used for Test/Live mode). */
function ModeSwitch({
  value,
  onChange,
}: {
  value: "test" | "live"
  onChange: (v: "test" | "live") => void
}) {
  return (
    <div className="flex gap-2">
      {(["test", "live"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
            value === m
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary/40"
          }`}
        >
          {m} mode
        </button>
      ))}
    </div>
  )
}

/** A password-style input with a show/hide toggle for secrets. */
function SecretInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        name={`turboride-${id}`}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide secret" : "Show secret"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function GlobalControls({ settings }: { settings: SiteSettings }) {
  const [paused, setPaused] = useState(settings.bookingsPaused)
  const [message, setMessage] = useState(settings.maintenanceMessage)
  const [lapKm, setLapKm] = useState(String(settings.lapDistanceKm))
  const [lapOptions, setLapOptions] = useState<number[]>(settings.lapOptions)
  const [minLeadDays, setMinLeadDays] = useState(String(settings.minLeadDays))
  // Discount is stored as a fraction but edited as a percentage here.
  const [discount, setDiscount] = useState(String(Math.round(settings.discount * 100)))
  const [reelPrice, setReelPrice] = useState(String(settings.reelPrice))
  // GST is stored as a fraction but edited as a percentage here.
  const [gst, setGst] = useState(String(Math.round(settings.gstRate * 100)))
  const [location, setLocation] = useState(settings.location)
  const [locationCoords, setLocationCoords] = useState(settings.locationCoords)
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      const res = await updateGlobalSettings({
        bookingsPaused: paused,
        maintenanceMessage: message,
        lapDistanceKm: Number(lapKm),
        lapOptions,
        minLeadDays: Number(minLeadDays),
        discount: Number(discount),
        reelPrice: Number(reelPrice),
        gstRate: Number(gst),
        location: location,
        locationCoords: locationCoords,
      })
      if (res.ok) toast.success("Global settings saved")
      else toast.error(res.error ?? "Could not save")
    })
  }

  return (
    <SectionCard
      icon={Power}
      title="Global Controls"
      description="Pause the storefront and tune pricing, discounts, and add-ons."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Pause all bookings</p>
            <p className="text-xs text-muted-foreground">Shows a maintenance banner and blocks new checkouts.</p>
          </div>
          <Toggle checked={paused} onChange={setPaused} label="Pause all bookings" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maint-msg">Maintenance banner message</Label>
          <textarea
            id="maint-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lap-km">Distance per lap (km)</Label>
          <Input
            id="lap-km"
            type="number"
            min={1}
            value={lapKm}
            onChange={(e) => setLapKm(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            One lap = this many km. Updates everywhere laps are shown (e.g. 2 laps = {(Number(lapKm) || 0) * 2} km).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Lap options offered to customers</Label>
          <LapOptionsPicker value={lapOptions} onChange={setLapOptions} />
          <p className="text-xs text-muted-foreground">
            Choose which lap counts (1–30) appear in the booking step. These work in tandem with distance per
            lap ({Number(lapKm) || 0} km) — e.g. a 5-lap option = {5 * (Number(lapKm) || 0)} km.{" "}
            {lapOptions.length === 0
              ? "Select at least one lap option."
              : `Currently offering: ${[...lapOptions].sort((a, b) => a - b).join(", ")}.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount">Full-pay discount (%)</Label>
          <Input
            id="discount"
            type="number"
            min={0}
            max={100}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Applied to the base fare when a customer pays in full online, for any number of laps. Customers who pay at
            the venue pay full price. Currently {Number(discount) || 0}%.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reel-price">Instagram reel add-on price (₹)</Label>
          <Input
            id="reel-price"
            type="number"
            min={0}
            value={reelPrice}
            onChange={(e) => setReelPrice(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Charged per reel in the booking add-ons step. Set to 0 to offer reels free. Currently{" "}
            {formatINR(Number(reelPrice) || 0)} per reel.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gst-rate">GST rate (%)</Label>
          <Input
            id="gst-rate"
            type="number"
            min={0}
            max={100}
            value={gst}
            onChange={(e) => setGst(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Applied to the subtotal on every quote and receipt. Set to 0 for no tax. Currently{" "}
            {Number(gst) || 0}%.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="drive-location">Drive location (Google Maps link)</Label>
          <Input
            id="drive-location"
            type="url"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The Google Maps link customers use to reach the track. Available in emails as the{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono">{"{{location}}"}</code> merge tag.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location-coords">Venue coordinates (lat, lng)</Label>
          <Input
            id="location-coords"
            inputMode="text"
            placeholder="13.240241, 77.278722"
            value={locationCoords}
            onChange={(e) => setLocationCoords(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Latitude and longitude, comma-separated. Powers the embedded map shown on the booking confirmation
            page. Copy them from Google Maps (right-click the spot → the first menu item is the lat/lng).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="min-lead-days">Minimum booking lead time (days)</Label>
          <Input
            id="min-lead-days"
            type="number"
            min={0}
            max={90}
            value={minLeadDays}
            onChange={(e) => setMinLeadDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            How far ahead customers must book on the date step.{" "}
            {Number(minLeadDays) === 0
              ? "Set to 0 — same-day bookings are allowed."
              : `Set to ${Number(minLeadDays) || 0} — the earliest selectable date is ${Number(minLeadDays) || 0} day${
                  (Number(minLeadDays) || 0) > 1 ? "s" : ""
                } from today.`}
          </p>
        </div>

        <Button onClick={save} disabled={pending} className="w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save global controls
        </Button>
      </div>
    </SectionCard>
  )
}

function PaymentGatewayConfig({ settings }: { settings: SiteSettings }) {
  const [gateway, setGateway] = useState<"phonepe" | "razorpay">(settings.paymentGateway)
  const [simulation, setSimulation] = useState(settings.paymentSimulation)
  // Razorpay
  const [rzpMode, setRzpMode] = useState<"test" | "live">(settings.razorpayMode)
  const [rzpKeyId, setRzpKeyId] = useState(settings.razorpayKeyId)
  const [rzpSecret, setRzpSecret] = useState(settings.razorpayKeySecret)
  // PhonePe (Supports both v2 OAuth and v1 SHA256 PG)
  const [ppMode, setPpMode] = useState<"test" | "live">(settings.phonepeMode)
  const [ppClientId, setPpClientId] = useState(settings.phonepeClientId)
  const [ppSecret, setPpSecret] = useState(settings.phonepeClientSecret)
  const [ppVersion, setPpVersion] = useState(settings.phonepeClientVersion)
  const [pending, start] = useTransition()
  const [testing, startTest] = useTransition()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  function save() {
    start(async () => {
      const res = await updatePaymentConfig({
        gateway,
        simulation,
        razorpay: { mode: rzpMode, keyId: rzpKeyId, keySecret: rzpSecret },
        phonepe: { mode: ppMode, clientId: ppClientId, clientSecret: ppSecret, clientVersion: ppVersion },
      })
      if (res.ok) toast.success("Payment gateway config saved")
      else toast.error(res.error ?? "Could not save")
    })
  }

  function runTest() {
    setTestResult(null)
    startTest(async () => {
      const res = await testPaymentGatewayAction({
        gateway,
        phonepe: { mode: ppMode, clientId: ppClientId, clientSecret: ppSecret, clientVersion: ppVersion },
        razorpay: { mode: rzpMode, keyId: rzpKeyId, keySecret: rzpSecret },
      })
      setTestResult(res)
      if (res.ok) toast.success("Payment gateway test passed!")
      else toast.error("Payment gateway test failed: " + res.message)
    })
  }

  return (
    <SectionCard
      icon={CreditCard}
      title="Payment Gateway"
      description="Choose PhonePe or Razorpay and store credentials for both. Keys are saved securely."
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label>Active gateway</Label>
          <div className="flex gap-2">
            {(
              [
                { id: "phonepe", label: "PhonePe" },
                { id: "razorpay", label: "Razorpay" },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGateway(g.id)}
                aria-pressed={gateway === g.id}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                  gateway === g.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Customers check out with <span className="font-medium text-foreground capitalize">{gateway}</span>. The
            other gateway&apos;s keys stay saved so you can switch anytime.
          </p>
        </div>

        <ToggleRow
          title="Simulation mode"
          description="On: bookings settle instantly with no real charge (use in preview/demos). Off: real charges via the active gateway."
          checked={simulation}
          onChange={setSimulation}
        />

        {/* PhonePe credentials */}
        {gateway === "phonepe" && (
        <div className="space-y-4 rounded-xl border border-primary/40 bg-accent/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">PhonePe (Standard Checkout / PG)</p>
              <p className="text-xs text-muted-foreground">Supports both v1 SHA256 (Merchant ID + Salt Key) and v2 OAuth credentials.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Active</span>
          </div>
          <div className="space-y-1.5">
            <Label>Environment Mode</Label>
            <ModeSwitch value={ppMode} onChange={setPpMode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-client-id">Client ID / Merchant ID</Label>
            <Input
              id="pp-client-id"
              name="turboride-pp-client-id"
              value={ppClientId}
              onChange={(e) => setPpClientId(e.target.value)}
              placeholder="e.g. PGTESTPAYUAT or TURBORIDEONLINE_XXXX"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-secret">Client Secret / Salt Key</Label>
            <SecretInput id="pp-secret" value={ppSecret} onChange={setPpSecret} placeholder="••••••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-version">Client Version / Key Index</Label>
            <Input id="pp-version" value={ppVersion} onChange={(e) => setPpVersion(e.target.value)} placeholder="1" />
            <p className="text-xs text-muted-foreground">
              From PhonePe Business dashboard. Usually <code className="rounded bg-secondary px-1 py-0.5 font-mono">1</code>.
            </p>
          </div>
        </div>
        )}

        {/* Razorpay credentials */}
        {gateway === "razorpay" && (
        <div className="space-y-4 rounded-xl border border-primary/40 bg-accent/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Razorpay (Payment Links)</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Active</span>
          </div>
          <div className="space-y-1.5">
            <Label>Environment Mode</Label>
            <ModeSwitch value={rzpMode} onChange={setRzpMode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rzp-key-id">Key ID</Label>
            <Input
              id="rzp-key-id"
              name="turboride-rzp-key-id"
              value={rzpKeyId}
              onChange={(e) => setRzpKeyId(e.target.value)}
              placeholder="rzp_test_XXXXXXXX / rzp_live_XXXXXXXX"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rzp-secret">Key Secret</Label>
            <SecretInput id="rzp-secret" value={rzpSecret} onChange={setRzpSecret} placeholder="••••••••••••" />
          </div>
        </div>
        )}

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-xs leading-relaxed ${
              testResult.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
            }`}
          >
            <p className="font-semibold">{testResult.ok ? "✓ Connection Successful" : "✗ Connection Error"}</p>
            <p className="mt-1 font-mono">{testResult.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={runTest} disabled={testing || pending} variant="outline" type="button">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Test {gateway === "phonepe" ? "PhonePe" : "Razorpay"}
          </Button>
          <Button onClick={save} disabled={pending || testing} className="w-full">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save gateway config
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}

function EmailConfig({ settings }: { settings: SiteSettings }) {
  const [simulation, setSimulation] = useState(settings.emailSimulation)
  const [host, setHost] = useState(settings.smtpHost)
  const [port, setPort] = useState(String(settings.smtpPort))
  const [user, setUser] = useState(settings.smtpUser)
  const [password, setPassword] = useState(settings.smtpPassword)
  const [fromEmail, setFromEmail] = useState(settings.smtpFromEmail || "booking@turboridesupercars.com")
  const [fromName, setFromName] = useState(settings.smtpFromName || "TurboRide Supercars")
  const [testRecipient, setTestRecipient] = useState(adminContactFallback(fromEmail))
  const [pending, start] = useTransition()
  const [testing, startTest] = useTransition()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  function adminContactFallback(fallback: string) {
    return fallback || "booking@turboridesupercars.com"
  }

  function save() {
    start(async () => {
      const res = await updateEmailConfig({
        simulation,
        host,
        port: Number.parseInt(port, 10) || 587,
        user,
        password,
        fromEmail,
        fromName,
      })
      if (res.ok) toast.success("Email config saved")
      else toast.error(res.error ?? "Could not save")
    })
  }

  function runTestEmail() {
    setTestResult(null)
    startTest(async () => {
      const res = await testEmailDeliveryAction({
        testRecipient,
        config: {
          host,
          port: Number.parseInt(port, 10) || 587,
          user,
          password,
          fromEmail,
          fromName,
        },
      })
      setTestResult(res)
      if (res.ok) toast.success("Test email sent!")
      else toast.error("SMTP test failed: " + res.message)
    })
  }

  return (
    <SectionCard
      icon={Mail}
      title="Email Delivery (MSG91 SMTP)"
      description="Booking emails are sent as your app's HTML templates over MSG91 SMTP. Requires a verified sending domain."
    >
      <div className="space-y-5">
        <ToggleRow
          title="Simulation mode"
          description="On: emails are logged/counted only (preview). Off: emails are delivered over live SMTP."
          checked={simulation}
          onChange={setSimulation}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.mailer91.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-port">Port</Label>
            <Input id="smtp-port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" className="w-24" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-user">SMTP username</Label>
          <Input id="smtp-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="From MSG91 → Email → Outbound" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-pass">SMTP password</Label>
          <SecretInput id="smtp-pass" value={password} onChange={setPassword} placeholder="••••••••••••" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-from-email">From email (Verified in MSG91)</Label>
            <Input id="smtp-from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="booking@turboridesupercars.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-from-name">From name</Label>
            <Input id="smtp-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="TurboRide Supercars" />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground text-pretty">
          Sender address must belong to a domain you verified in MSG91 (Email → Domains), with SPF/DKIM DNS records added. Port 587 uses STARTTLS; 465 uses SSL.
        </div>

        {/* Test Email Dispatch Form */}
        <div className="rounded-xl border border-border bg-background/50 p-3.5 space-y-3">
          <Label htmlFor="test-recipient" className="text-xs font-semibold">Test Email Recipient</Label>
          <div className="flex gap-2">
            <Input
              id="test-recipient"
              type="email"
              placeholder="your-email@example.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="text-xs"
            />
            <Button
              type="button"
              onClick={runTestEmail}
              disabled={testing || pending || !testRecipient}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Send Test
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-xs leading-relaxed ${
              testResult.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
            }`}
          >
            <p className="font-semibold">{testResult.ok ? "✓ SMTP Test Passed" : "✗ SMTP Connection Failed"}</p>
            <p className="mt-1 font-mono">{testResult.message}</p>
          </div>
        )}

        <Button onClick={save} disabled={pending || testing} className="mt-5 w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save email config
        </Button>
      </div>
    </SectionCard>
  )
}

function AdminProfile({ admin }: { admin: { name: string; email: string } }) {
  const [name, setName] = useState(admin.name)
  const [email, setEmail] = useState(admin.email)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [savingProfile, startProfile] = useTransition()
  const [savingPw, startPw] = useTransition()

  function saveProfile() {
    startProfile(async () => {
      const res = await updateAdminProfile({ name, email })
      if (res.ok) toast.success("Profile updated")
      else toast.error(res.error ?? "Could not update profile")
    })
  }

  function savePassword() {
    startPw(async () => {
      const res = await changeAdminPassword(current, next)
      if (res.ok) {
        toast.success("Password changed")
        setCurrent("")
        setNext("")
      } else toast.error(res.error ?? "Could not change password")
    })
  }

  return (
    <SectionCard
      icon={UserCog}
      title="Admin Profile"
      description="Update your name, contact email, and password."
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="admin-name">Name</Label>
          <Input id="admin-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Contact email</Label>
          <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile} variant="outline" className="w-full">
          {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update profile
        </Button>

        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Change password</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input id="cur-pw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <Button onClick={savePassword} disabled={savingPw || !current || !next} className="w-full">
              {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
