"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import type { Car } from "@/lib/turboride/fleet"
import { formatINR } from "@/lib/turboride/fleet"
import { updateCar, toggleCarActive, deleteCar, type CarInput } from "@/app/actions/admin-fleet"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "./admin-ui"
import { Pencil, X, Loader2, Check, Eye, EyeOff, Plus, Trash2 } from "lucide-react"

type AdminCar = Car & { isActive: boolean; sortOrder: number }

const STATUS_OPTIONS = [
  { value: "available", label: "Available Now" },
  { value: "paused", label: "Paused — temporarily unavailable" },
  { value: "comingsoon", label: "Coming Soon" },
]

export function FleetManager({ cars }: { cars: AdminCar[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AdminCar | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminCar | null>(null)
  const [pending, startTransition] = useTransition()

  function refresh() {
    setEditing(null)
    startTransition(() => router.refresh())
  }

  async function toggle(car: AdminCar) {
    try {
      await toggleCarActive(car.id, !car.isActive)
    } catch (e) {
      console.error("[v0] toggle() error:", e)
    }
    startTransition(() => router.refresh())
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cars.map((car) => (
          <div
            key={car.id}
            className={`overflow-hidden rounded-2xl border border-border bg-card transition-opacity ${
              car.isActive ? "" : "opacity-60"
            }`}
          >
            <div className="relative h-36 overflow-hidden bg-white">
              <Image
                src={car.image || "/placeholder.svg"}
                alt={car.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-contain p-3"
              />
              <div className="absolute left-3 top-3">
                <StatusBadge status={car.status} />
              </div>
              {!car.isActive && (
                <span className="absolute right-3 top-3 rounded-full bg-foreground/80 px-2 py-0.5 text-xs font-semibold text-background">
                  Hidden
                </span>
              )}
            </div>

            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{car.brand}</p>
              <h3 className="font-display text-lg font-bold text-foreground">{car.name}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-semibold text-foreground">{formatINR(car.pricePerLap)}</span>
                <span className="text-xs text-muted-foreground">/ lap</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {car.pricePerRideAlongLap && car.pricePerRideAlongLap > 0
                  ? `Ride-along ${formatINR(car.pricePerRideAlongLap)} / lap`
                  : "No co-passenger ride-along"}
              </p>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(car)} className="flex-1">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggle(car)}
                  disabled={pending}
                  aria-label={car.isActive ? "Hide from storefront" : "Show on storefront"}
                >
                  {car.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(car)}
                  disabled={pending}
                  aria-label={`Delete ${car.name}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <CarEditor car={editing} onClose={() => setEditing(null)} onSaved={refresh} />}

      {confirmDelete && (
        <DeleteDialog
          car={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onDeleted={() => {
            setConfirmDelete(null)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}

function DeleteDialog({ car, onClose, onDeleted }: { car: AdminCar; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setDeleting(true)
    setError(null)
    try {
      const res = await deleteCar(car.id)
      if (!res.ok) {
        setError(res.error ?? "Could not delete this car.")
        return
      }
      onDeleted()
    } catch (e) {
      console.error("[v0] deleteCar() error:", e)
      setError("Something went wrong while deleting. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/40" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-car-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 id="delete-car-title" className="font-display text-lg font-bold text-foreground">
          Delete {car.name}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          This permanently removes {car.name} from the fleet and every storefront surface. This can&apos;t be undone. If
          the car has bookings, hide it instead so its history is preserved.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting} className="flex-1">
            {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Delete car
          </Button>
        </div>
      </div>
    </div>
  )
}

function CarEditor({ car, onClose, onSaved }: { car: AdminCar; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CarInput>({
    id: car.id,
    name: car.name,
    brand: car.brand,
    image: car.image,
    status: car.status,
    pricePerLap: car.pricePerLap,
    pricePerRideAlongLap: car.pricePerRideAlongLap ?? 0,
    // regularPrice + deposit are retired pre-book fields — kept dormant in the DB as null.
    regularPrice: null,
    deposit: null,
    bookingType: car.bookingType,
    specs: car.specs ?? [],
    perks: car.perks ?? [],
    accent: car.accent,
    exShowroom: car.exShowroom ?? null,
    isActive: car.isActive,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof CarInput>(key: K, value: CarInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await updateCar(form)
      if (!res.ok) {
        setError(res.error ?? "Could not save.")
        return
      }
      onSaved()
    } catch (e) {
      console.error("[v0] save() error:", e)
      setError("Something went wrong while saving. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/40" />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-card shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="font-display font-bold text-foreground">Edit {car.name}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Name" value={form.name} onChange={(v) => set("name", v)} />
            <TextField label="Brand" value={form.brand} onChange={(v) => set("brand", v)} />
          </div>

          <TextField label="Image path" value={form.image} onChange={(v) => set("image", v)} placeholder="/cars/car.png" />

          <div className="space-y-1.5">
            <TextField
              label="Ex-showroom price (India)"
              value={form.exShowroom ?? ""}
              onChange={(v) => set("exShowroom", v.trim() === "" ? null : v)}
              placeholder="e.g. ₹3,50,00,000"
            />
            <p className="text-xs text-muted-foreground">
              Real-world road-car price shown on the car page. Leave blank to hide the card.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Price / lap (₹)" value={form.pricePerLap} onChange={(v) => set("pricePerLap", v ?? 0)} />
            <NumberField
              label="Price / ride-along lap (₹)"
              value={form.pricePerRideAlongLap}
              onChange={(v) => set("pricePerRideAlongLap", v ?? 0)}
            />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Charge to bring a co-passenger along per lap (lap 1 is always with the safety instructor). Set to 0 to hide
            the co-passenger add-on for this car.
          </p>

          {/* Specs */}
          <ListEditor
            label="Specs"
            items={form.specs.map((s) => `${s.label}|${s.value}`)}
            placeholder="Label | Value  (e.g. 0-100 | 3.2s)"
            onChange={(items) =>
              set(
                "specs",
                items.map((raw) => {
                  const [label, value] = raw.split("|")
                  return { label: (label ?? "").trim(), value: (value ?? "").trim() }
                }),
              )
            }
          />

          {/* Perks */}
          <ListEditor
            label="Perks"
            items={form.perks}
            placeholder="e.g. Complimentary helmet & briefing"
            onChange={(items) => set("perks", items)}
          />

          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Visible on storefront
          </label>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-card p-5">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
            Save &amp; publish
          </Button>
        </div>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  nullable,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  nullable?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === "") return onChange(nullable ? null : 0)
          onChange(Number.parseInt(raw, 10))
        }}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </div>
  )
}

function ListEditor({
  label,
  items,
  placeholder,
  onChange,
}: {
  label: string
  items: string[]
  placeholder?: string
  onChange: (items: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded-lg border border-border px-2 text-muted-foreground hover:bg-muted"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add {label.toLowerCase().replace(/s$/, "")}
        </Button>
      </div>
    </div>
  )
}
