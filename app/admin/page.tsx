import Link from "next/link"
import { getAdminStats, getRecentBookings } from "@/lib/turboride/admin-data"
import { formatINR } from "@/lib/turboride/fleet"
import { PageHeader, StatCard, StatusBadge } from "@/components/admin/admin-ui"
import { CalendarCheck, IndianRupee, Users, Car, Wallet, Hourglass } from "lucide-react"

export const metadata = { title: "Dashboard — TurboRide Admin" }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default async function AdminDashboardPage() {
  const [stats, recent] = await Promise.all([getAdminStats(), getRecentBookings()])

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview and recent activity" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={CalendarCheck}
          label="Total bookings"
          value={stats.totalBookings.toLocaleString("en-IN")}
          hint={`${stats.confirmedBookings} scheduled`}
          tone="brand"
        />
        <StatCard
          icon={IndianRupee}
          label="Total booking value"
          value={formatINR(stats.totalRevenue)}
          hint="Across all bookings"
          tone="info"
        />
        <StatCard
          icon={Wallet}
          label="Collected"
          value={formatINR(stats.collectedRevenue)}
          hint="Payments received so far"
          tone="success"
        />
        <StatCard
          icon={Hourglass}
          label="Pending"
          value={formatINR(stats.totalRevenue - stats.collectedRevenue)}
          hint="Balance due at venue"
          tone="warning"
        />
        <StatCard
          icon={Users}
          label="Customers"
          value={stats.totalCustomers.toLocaleString("en-IN")}
          hint="Unique by email"
          tone="violet"
        />
        <StatCard
          icon={Car}
          label="Active cars"
          value={stats.activeCars.toLocaleString("en-IN")}
          hint="Live on the storefront"
          tone="cyan"
        />
      </div>

      {/* Recent bookings */}
      <div className="mt-6 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display font-bold text-foreground">Recent bookings</h2>
          <Link href="/admin/bookings" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((b) => (
              <li key={b.reference} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{b.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.carName}
                    {b.carCount > 1 && <span className="text-primary"> +{b.carCount - 1} more</span>} · {b.reference} ·{" "}
                    {timeAgo(b.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{formatINR(b.total)}</span>
                  <StatusBadge status={b.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
