import type { LucideIcon } from "lucide-react"

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground text-balance sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Semantic color tones for dashboard stat cards. Each maps to a faint card wash
 *  and a matching icon-chip tint so the stats read as color-coded at a glance. */
export type StatTone = "brand" | "info" | "success" | "warning" | "violet" | "cyan"

const STAT_TONES: Record<StatTone, { wash: string; chip: string }> = {
  brand: { wash: "from-primary/[0.18]", chip: "bg-primary/20 text-primary ring-1 ring-inset ring-primary/30" },
  info: { wash: "from-chart-2/[0.20]", chip: "bg-chart-2/20 text-chart-2 ring-1 ring-inset ring-chart-2/30" },
  success: { wash: "from-success/[0.20]", chip: "bg-success/20 text-success ring-1 ring-inset ring-success/35" },
  warning: { wash: "from-warning/[0.28]", chip: "bg-warning/30 text-warning-foreground ring-1 ring-inset ring-warning/45" },
  violet: {
    wash: "from-[oklch(0.55_0.2_290)]/[0.20]",
    chip: "bg-[oklch(0.55_0.2_290)]/20 text-[oklch(0.5_0.2_290)] ring-1 ring-inset ring-[oklch(0.55_0.2_290)]/30",
  },
  cyan: {
    wash: "from-[oklch(0.6_0.12_205)]/[0.22]",
    chip: "bg-[oklch(0.6_0.12_205)]/20 text-[oklch(0.5_0.12_205)] ring-1 ring-inset ring-[oklch(0.6_0.12_205)]/30",
  },
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  /** Semantic accent color for the card. Defaults to the brand tone. */
  tone?: StatTone
}) {
  const t = STAT_TONES[tone]
  return (
    <div
      className={`rounded-2xl border border-border bg-card bg-gradient-to-br ${t.wash} to-transparent p-5 shadow-sm transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.chip}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold text-foreground sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  // Booking statuses ("confirmed" is treated as "scheduled" — same style)
  confirmed: "border-primary/30 bg-accent text-primary",
  scheduled: "border-primary/30 bg-accent text-primary",
  redeemed: "border-success/40 bg-success text-success-foreground",
  // "cancelled" is the stored value for a lapsed booking; surfaced as "Expired".
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  refunded: "border-border bg-secondary text-muted-foreground",
  // Car statuses
  available: "border-success/30 bg-success-muted text-success",
  paused: "border-warning/40 bg-warning-muted text-warning-foreground",
  comingsoon: "border-border bg-secondary text-muted-foreground",
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Scheduled",
  scheduled: "Scheduled",
  redeemed: "Redeemed",
  cancelled: "Expired",
  expired: "Expired",
  refunded: "Refunded",
  available: "Available Now",
  paused: "Temporarily Unavailable",
  comingsoon: "Coming Soon",
}

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "border-border bg-secondary text-muted-foreground"
  const label = STATUS_LABELS[status] ?? status
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}
