"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { adminLogin, type AdminLoginResult } from "@/app/actions/admin-auth"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Loader2 } from "lucide-react"

const initial: AdminLoginResult = { ok: false }

export function AdminLoginForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(adminLogin, initial)

  useEffect(() => {
    if (state.ok) {
      window.location.href = "/admin"
    }
  }, [state.ok])

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-foreground">TurboRide Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage the platform</p>
      </div>

      <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="admin@turboride.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••••••"
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
