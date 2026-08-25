import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { BookingWizard } from "@/components/booking/booking-wizard"
import { getFleet } from "@/lib/turboride/cars"
import { getPublicSettings } from "@/lib/turboride/settings"
import { getPublicAvailability } from "@/lib/turboride/schedule"
import { getContactPrefill } from "@/app/actions/booking"
import { formatINR } from "@/lib/turboride/fleet"
import { AlertTriangle } from "lucide-react"

export default async function Page({ searchParams }: { searchParams?: Promise<{ car?: string }> }) {
  const params = await searchParams
  const selectedCarSlug = params?.car

  const [fleet, settings, availability, contactPrefill] = await Promise.all([
    getFleet(),
    getPublicSettings(),
    getPublicAvailability(),
    getContactPrefill(),
  ])

  const lockedCar = selectedCarSlug ? fleet.find((c) => c.id === selectedCarSlug) ?? null : null

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      {settings.bookingsPaused && (
        <div className="border-b border-warning/40 bg-warning-muted">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 text-sm text-warning-foreground sm:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-pretty">{settings.maintenanceMessage}</span>
          </div>
        </div>
      )}

      {/* Fleet showcase */}
      <section id="fleet" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">The fleet</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground text-balance">
            Six supercars. One open highway.
          </h2>
          <p className="max-w-2xl text-muted-foreground text-pretty">
            Pick your machine, choose your laps, and book an open-highway drive. Pay in full online for an instant
            discount, or settle up at the venue on drive day.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fleet.map((car, index) => (
            <div
              key={car.id}
              className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-sm"
            >
              <div className="relative flex aspect-[16/10] items-center justify-center bg-white">
                <Image
                  src={car.image || "/placeholder.svg"}
                  alt={car.name}
                  width={480}
                  height={300}
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="h-full w-[78%] object-contain transition-transform duration-300 group-hover:scale-105"
                  priority={index === 0}
                />
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    car.status === "available"
                      ? "bg-success-muted text-success"
                      : car.status === "paused"
                        ? "bg-warning-muted text-warning-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {car.status === "available"
                    ? "Available Now"
                    : car.status === "paused"
                      ? "Temporarily Unavailable"
                      : "Coming Soon"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{car.brand}</p>
                  <p className="font-display font-bold text-foreground">{car.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{formatINR(car.pricePerLap)}</p>
                  <p className="text-xs text-muted-foreground">/ lap</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Booking */}
      <section id="book" className="border-t border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Book your drive</span>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground text-balance">
              Build your highway drive
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Six quick steps from eligibility to checkout. Your order summary updates live as you go.
            </p>
          </div>
          <div className="mt-8">
            <BookingWizard
              fleet={fleet}
              lockedCar={lockedCar}
              availability={availability}
              bookingsPaused={settings.bookingsPaused}
              lapDistanceKm={settings.lapDistanceKm}
              lapOptions={settings.lapOptions}
              minLeadDays={settings.minLeadDays}
              discountRates={{ discount: settings.discount }}
              reelPrice={settings.reelPrice}
              gstRate={settings.gstRate}
              locationCoords={settings.locationCoords}
              contactPrefill={contactPrefill}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Turboride. Drive fast, drive safe.</p>
          <p>Simulated payment demo — no real charges.</p>
        </div>
      </footer>
    </div>
  )
}
