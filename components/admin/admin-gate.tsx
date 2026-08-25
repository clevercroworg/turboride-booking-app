"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import type { AdminUser } from "@/lib/turboride/admin-auth"
import { AdminShell } from "./admin-shell"

/**
 * Client route guard for /admin/*. The login page renders bare (no shell);
 * every other admin route requires an authenticated admin or redirects to login.
 */
export function AdminGate({ admin, children }: { admin: AdminUser | null; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginRoute = pathname === "/admin/login"

  useEffect(() => {
    if (!admin && !isLoginRoute) router.replace("/admin/login")
  }, [admin, isLoginRoute, router])

  if (isLoginRoute) return <>{children}</>
  if (!admin) return null // redirecting

  return <AdminShell admin={admin}>{children}</AdminShell>
}
