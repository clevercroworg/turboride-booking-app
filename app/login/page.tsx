import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { LoginForm } from "@/components/auth/login-form"
import { getSessionIdentifier } from "@/app/actions/auth"

export const metadata = {
  title: "Sign in · Turboride",
  description: "Sign in with the email or mobile number from your booking to manage your Turboride drives.",
}

export default async function LoginPage() {
  const identifier = await getSessionIdentifier()
  if (identifier) redirect("/account")

  return (
    <main className="min-h-dvh bg-background">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-16 sm:px-6">
        <LoginForm />
      </div>
    </main>
  )
}
