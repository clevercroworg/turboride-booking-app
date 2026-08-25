"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { requestLoginOtp, verifyLoginOtp } from "@/app/actions/auth"
import { ArrowLeft, KeyRound, Loader2, Mail, Smartphone } from "lucide-react"

type Phase = "identify" | "verify"

export function LoginForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("identify")
  const [identifier, setIdentifier] = useState("")
  const [code, setCode] = useState("")
  const [channel, setChannel] = useState<"email" | "sms">("email")
  const [masked, setMasked] = useState("")
  const [demoCode, setDemoCode] = useState("")
  const [loading, setLoading] = useState(false)

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      const res = await requestLoginOtp(identifier)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setChannel(res.channel)
      setMasked(res.masked)
      setDemoCode(res.demoCode)
      setCode("")
      setPhase("verify")
      toast.success(res.channel === "email" ? "Code sent to your email." : "Code sent via SMS.")
    } catch {
      toast.error("Couldn't send a code right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return
    if (code.replace(/\D/g, "").length !== 4) {
      toast.error("Enter the 4-digit code.")
      return
    }
    setLoading(true)
    try {
      const res = await verifyLoginOtp(identifier, code)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Signed in.")
      router.push("/account")
      router.refresh()
    } catch {
      toast.error("Verification failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
          <KeyRound className="h-6 w-6" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          Sign in to Turboride
        </h1>
        <p className="text-sm text-muted-foreground text-balance">
          {phase === "identify"
            ? "Use the email or mobile number from your booking. We'll send a 4-digit code."
            : `Enter the 4-digit code we sent to ${masked}.`}
        </p>
      </div>

      {phase === "identify" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <Label htmlFor="identifier">Email or mobile number</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or 98765 43210"
              className="mt-1.5"
              autoComplete="username"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || identifier.trim().length < 3}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send code
          </Button>
          <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> Email OTP
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5" /> SMS OTP
            </span>
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {demoCode && (
            <div className="rounded-lg border border-primary/30 bg-accent px-4 py-3 text-sm text-foreground">
              <span className="font-semibold text-primary">Demo mode:</span> no SMS/email provider is wired up, so
              your code is{" "}
              <span className="font-mono text-base font-bold tracking-widest text-foreground">{demoCode}</span>.
            </div>
          )}
          <div>
            <Label htmlFor="otp">4-digit code</Label>
            <Input
              id="otp"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              inputMode="numeric"
              maxLength={4}
              className="mt-1.5 text-center font-mono text-2xl tracking-[0.6em]"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 4}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify &amp; sign in
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setPhase("identify")
                setCode("")
              }}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change
            </button>
            <button
              type="button"
              onClick={() => sendCode()}
              disabled={loading}
              className="text-primary transition-colors hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
