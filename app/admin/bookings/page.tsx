import { getAdminBookings } from "@/lib/turboride/admin-bookings"
import { getPublicSettings } from "@/lib/turboride/settings"
import { PageHeader } from "@/components/admin/admin-ui"
import { BookingsTable } from "@/components/admin/bookings-table"

export const metadata = { title: "Bookings — TurboRide Admin" }

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    range?: string
    sort?: string
    sortBy?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  // Default landing view: all scheduled bookings for the next 7 days.
  const filters = {
    q: sp.q ?? "",
    status: sp.status ?? "scheduled",
    range: (sp.range as "all" | "today" | "next7") ?? "next7",
    sort: (sp.sort as "asc" | "desc") ?? "asc",
    sortBy: (sp.sortBy as "date" | "booked") ?? "date",
    page: sp.page ? Number.parseInt(sp.page, 10) : 1,
  }
  const [data, settings] = await Promise.all([getAdminBookings(filters), getPublicSettings()])

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${data.total.toLocaleString("en-IN")} total booking${data.total === 1 ? "" : "s"}`}
      />
      <BookingsTable data={data} filters={filters} lapDistanceKm={settings.lapDistanceKm} />
    </div>
  )
}
