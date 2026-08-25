import { Progress } from "@/components/ui/progress"
import { Flag } from "lucide-react"

export function PrebookProgress({
  count,
  threshold,
}: {
  count: number
  threshold: number
}) {
  const pct = Math.min(100, Math.round((count / threshold) * 100))
  const remaining = Math.max(0, threshold - count)
  const reached = count >= threshold

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
            <Flag className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-foreground">Pre-launch countdown</p>
            <p className="text-xs text-muted-foreground">
              {reached
                ? "Threshold reached — launch date is locked in."
                : `${remaining.toLocaleString("en-IN")} pre-bookings to go until we lock the launch date.`}
            </p>
          </div>
        </div>
        <p className="font-display text-lg font-extrabold text-primary tabular-nums">
          {count.toLocaleString("en-IN")}
          <span className="text-sm font-semibold text-muted-foreground">
            {" "}
            / {threshold.toLocaleString("en-IN")}
          </span>
        </p>
      </div>
      <div className="mt-3">
        <Progress value={pct} />
      </div>
    </div>
  )
}
