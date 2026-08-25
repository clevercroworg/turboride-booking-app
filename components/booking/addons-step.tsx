"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { formatINR, REEL_PRICE } from "@/lib/turboride/fleet"
import { Camera, Film, Minus, Plus, PlayCircle, X } from "lucide-react"

/** YouTube Short used as the sample reel of a customer drive experience. */
const SAMPLE_REEL_ID = "8l_qIO3t-h0"

export function AddonsStep({
  reels,
  onChange,
  reelPrice = REEL_PRICE,
}: {
  reels: number
  onChange: (reels: number) => void
  /** Price per reel (from admin Settings). */
  reelPrice?: number
}) {
  const [showSample, setShowSample] = useState(false)

  // Close the sample-reel modal with the Escape key.
  useEffect(() => {
    if (!showSample) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSample(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showSample])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-muted p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success text-success-foreground">
          <Camera className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-foreground">10 Drive Photos</p>
          <p className="text-sm text-muted-foreground">
            Included free with every booking, shot roadside by our crew.
          </p>
        </div>
        <span className="ml-auto rounded-md bg-success px-2 py-1 text-xs font-bold text-success-foreground">
          FREE
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Film className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Instagram Reel (30–40s)</p>
          <p className="text-sm text-muted-foreground">
            Cinematic edit of your drive. {formatINR(reelPrice)} per reel.
          </p>
          <button
            type="button"
            onClick={() => setShowSample(true)}
            className="mt-1 inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlayCircle className="h-4 w-4" /> Watch sample reel
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange(Math.max(0, reels - 1))}
            disabled={reels === 0}
            aria-label="Remove one reel"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-6 text-center text-lg font-bold tabular-nums text-foreground">{reels}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange(reels + 1)}
            aria-label="Add one reel"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showSample && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sample Instagram reel"
          onClick={() => setShowSample(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setShowSample(false)}
            aria-label="Close video"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl bg-black shadow-2xl"
          >
            <iframe
              src={`https://www.youtube.com/embed/${SAMPLE_REEL_ID}?autoplay=1&playsinline=1&rel=0`}
              title="Sample reel of a customer drive experience"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  )
}
