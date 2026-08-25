import { getAdmin } from "@/lib/turboride/admin-auth"
import { AdminGate } from "@/components/admin/admin-gate"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin()
  return <AdminGate admin={admin}>{children}</AdminGate>
}
