import { redirect } from "next/navigation"
import { getAdmin } from "@/lib/turboride/admin-auth"
import { AdminLoginForm } from "@/components/admin/admin-login-form"

export const metadata = {
  title: "Admin Sign In — TurboRide",
}

export default async function AdminLoginPage() {
  const admin = await getAdmin()
  if (admin) redirect("/admin")

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted px-4">
      <AdminLoginForm />
    </main>
  )
}
