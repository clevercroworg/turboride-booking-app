"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Menu, X, User, Calendar, LogIn, LogOut } from "lucide-react"
import { logout } from "@/app/actions/auth"

export function SiteNavMenu({ signedIn }: { signedIn: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    setSigningOut(true)
    try {
      await logout()
      setOpen(false)
      router.push("/login")
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-primary/40"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {signedIn ? (
            <>
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <User className="h-4 w-4 text-muted-foreground" /> My account
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <LogIn className="h-4 w-4 text-muted-foreground" /> Sign in
            </Link>
          )}
          <a
            href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://www.turboridesupercars.com"}
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Explore Main Site ↗
          </a>
          <Link
            href="/#book"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Calendar className="h-4 w-4" /> Book Now
          </Link>
        </div>
      )}
    </div>
  )
}
