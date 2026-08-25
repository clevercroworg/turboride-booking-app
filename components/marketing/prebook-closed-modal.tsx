"use client"

import { useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, ArrowRight } from "lucide-react"

/**
 * Full-screen, non-dismissible lockout shown on a car mini-page once the campaign
 * has gone live. Pre-bookings are closed, so the visitor must NOT be able to
 * browse the mini-page behind it — there is no close button, no click-outside or
 * Escape handling, and background scroll/focus is trapped. The only way forward
 * is the link to the main landing page to book the car directly.
 */
export function PrebookClosedModal({ carName }: { carName: string }) {
  // Lock background scroll while the modal is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prebook-closed-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-muted text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h2
          id="prebook-closed-title"
          className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground text-balance"
        >
          Pre-bookings are closed
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
          The pre-launch spots for the {carName} are all taken and the {carName} is now live. You can book it directly
          from our main booking page — pick your date and time slot there.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Go to booking page
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
