import { PageHeader } from "@/components/admin/admin-ui"
import { SettingsManager } from "@/components/admin/settings-manager"
import { getSettings } from "@/lib/turboride/settings"
import { getAdmin } from "@/lib/turboride/admin-auth"

export const metadata = { title: "Settings — TurboRide Admin" }

export default async function AdminSettingsPage() {
  const [settings, admin] = await Promise.all([getSettings(), getAdmin()])

  return (
    <div>
      <PageHeader title="System Settings" subtitle="Global controls, payments, and your admin profile" />
      <SettingsManager
        settings={settings}
        admin={admin ? { name: admin.name, email: admin.email } : { name: "", email: "" }}
      />
    </div>
  )
}
