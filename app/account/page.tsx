import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { AccountDashboard } from "@/components/account/account-dashboard"
import { getMyBookings } from "@/app/actions/booking"
import { getFleet } from "@/lib/turboride/cars"
import { getPublicSettings } from "@/lib/turboride/settings"
import { getPublicAvailability } from "@/lib/turboride/schedule"

export default async function AccountPage() {
  const account = await getMyBookings()
  if (!account) redirect("/login")
  const [fleet, settings, availability] = await Promise.all([
    getFleet(),
    getPublicSettings(),
    getPublicAvailability(),
  ])

  return (
    <main className="min-h-dvh bg-background">
      <SiteHeader />
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <AccountDashboard
          account={account}
          fleet={fleet}
          availability={availability}
          lapDistanceKm={settings.lapDistanceKm}
          minLeadDays={settings.minLeadDays}
          discountRate={settings.discount}
          gstRate={settings.gstRate}
        />
      </div>
    </main>
  )
}
