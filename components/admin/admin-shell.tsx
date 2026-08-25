"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { adminLogout } from "@/app/actions/admin-auth"
import { Button } from "@/components/ui/button"
import type { AdminUser } from "@/lib/turboride/admin-auth"
import {
  LayoutDashboard,
  CalendarCheck,
  Car,
  CalendarClock,
  Mail,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react"

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/fleet", label: "Fleet", icon: Car },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

export function AdminShell({ admin, children }: { admin: AdminUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(item.href, item.exact)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-dvh bg-muted">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-display font-bold text-foreground">TurboRide Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-1.5 text-foreground hover:bg-muted"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "block" : "hidden"
          } border-b border-border bg-card p-4 lg:sticky lg:top-0 lg:block lg:h-dvh lg:border-b-0 lg:border-r`}
        >
          <div className="flex h-full flex-col">
            <div className="mb-6 hidden items-center gap-2 px-2 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-sm font-bold leading-tight text-foreground">TurboRide</p>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </div>

            {nav}

            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-2 px-2">
                <p className="truncate text-sm font-medium text-foreground">{admin.name}</p>
                <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
              </div>
              <form action={adminLogout}>
                <Button type="submit" variant="outline" className="w-full justify-start">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </form>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  )
}
