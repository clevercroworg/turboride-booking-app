"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Clock, ArrowRight } from "lucide-react"

/**
 * Full-screen, non-dismissible lockout shown on a car mini-page when the car's
 * status is "coming soon". The car is NOT open for booking yet, so the visitor
 * must not be able to reach the booking wizard behind it — there is no close
 * button, no click-outside or Escape handling, and background scroll/focus is
 * trapped. The only way forward is back to the main landing page.
 */
export function ComingSoonModal({ carName }: { carName: string }) {
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
      aria-labelledby="coming-soon-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Clock className="h-7 w-7" aria-hidden />
        </span>
        <h2
          id="coming-soon-title"
          className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground text-balance"
        >
          {carName} is coming soon
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
          The {carName}
          {" "}isn&apos;t open for booking just yet. Explore the cars you can drive today on our main page — we&apos;ll
          announce the {carName}
          {" "}the moment it&apos;s ready.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Explore available cars
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
