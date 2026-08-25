import { getAllCars } from "@/lib/turboride/cars"
import { PageHeader } from "@/components/admin/admin-ui"
import { FleetManager } from "@/components/admin/fleet-manager"

export const metadata = { title: "Fleet — TurboRide Admin" }

export default async function AdminFleetPage() {
  const cars = await getAllCars()

  return (
    <div>
      <PageHeader
        title="Fleet"
        subtitle="Edit cars, pricing, and availability. Changes reflect on the storefront instantly."
      />
      <FleetManager cars={cars} />
    </div>
  )
}
