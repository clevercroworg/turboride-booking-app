import { PageHeader } from "@/components/admin/admin-ui"
import { ScheduleManager } from "@/components/admin/schedule-manager"
import { getScheduleOverview } from "@/lib/turboride/schedule"

export const metadata = { title: "Schedule — TurboRide Admin" }

export default async function AdminSchedulePage() {
  const overview = await getScheduleOverview()

  return (
    <div>
      <PageHeader title="Schedule & Slots" subtitle="Blackout dates, slot capacity, and a live booking calendar" />
      <ScheduleManager
        slots={overview.slots}
        blackouts={overview.blackouts}
        dayCounts={overview.dayCounts}
        daySlotCounts={overview.daySlotCounts}
      />
    </div>
  )
}
