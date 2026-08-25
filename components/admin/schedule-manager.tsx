"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addBlackout, removeBlackout, updateSlot } from "@/app/actions/admin-schedule"
import type { SlotSetting, BlackoutRange } from "@/lib/turboride/schedule"
import {
  ChevronLeft,
  ChevronRight,
  CalendarOff,
  Clock,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type Props = {
  slots: SlotSetting[]
  blackouts: BlackoutRange[]
  dayCounts: Record<string, number>
  daySlotCounts: Record<string, number>
}

export function ScheduleManager({ slots, blackouts, dayCounts, daySlotCounts }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <CalendarView blackouts={blackouts} dayCounts={dayCounts} daySlotCounts={daySlotCounts} slots={slots} />
      <div className="space-y-5">
        <BlackoutManager blackouts={blackouts} />
        <SlotManager slots={slots} />
      </div>
    </div>
  )
}

function CalendarView({
  blackouts,
  dayCounts,
  daySlotCounts,
  slots,
}: {
  blackouts: BlackoutRange[]
  dayCounts: Record<string, number>
  daySlotCounts: Record<string, number>
  slots: SlotSetting[]
}) {
  const now = new Date()
  const [view, setView] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState<string | null>(null)

  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const isBlackout = useMemo(
    () => (key: string) => blackouts.some((b) => key >= b.startDate && key <= b.endDate),
    [blackouts],
  )

  const totalCapacity = slots.filter((s) => s.isActive).reduce((sum, s) => sum + s.capacity, 0)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {MONTHS[month]} {year}
          </h2>
          <p className="text-xs text-muted-foreground">Numbers show booked drives that day.</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setView(new Date(year, month - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setView(new Date(year, month + 1, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-xs font-semibold text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />
          const key = ymd(cell)
          const blocked = isBlackout(key)
          const count = dayCounts[key] ?? 0
          const isSelected = selected === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(isSelected ? null : key)}
              className={`relative flex h-14 flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-accent"
                  : blocked
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <span className={`font-medium ${blocked ? "text-destructive line-through" : "text-foreground"}`}>
                {cell.getDate()}
              </span>
              {blocked ? (
                <span className="text-[10px] font-medium text-destructive">Closed</span>
              ) : count > 0 ? (
                <span className="mt-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">
            {new Date(selected).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {isBlackout(selected) ? (
            <p className="text-sm text-destructive">This date is blacked out — no bookings accepted.</p>
          ) : (
            <div className="space-y-1.5">
              {slots.map((s) => {
                const booked = daySlotCounts[`${selected}__${s.slot}`] ?? 0
                const full = booked >= s.capacity
                return (
                  <div key={s.slot} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.slot}</span>
                    <span className={full ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {s.isActive ? `${booked}/${s.capacity}${full ? " · sold out" : ""}` : "inactive"}
                    </span>
                  </div>
                )
              })}
              <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                Daily capacity: {totalCapacity} drives across active slots.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BlackoutManager({ blackouts }: { blackouts: BlackoutRange[] }) {
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  function add() {
    if (!start) {
      toast.error("Pick a start date.")
      return
    }
    startTransition(async () => {
      const res = await addBlackout(start, end || start, reason)
      if (res.ok) {
        toast.success("Blackout added")
        setStart("")
        setEnd("")
        setReason("")
      } else toast.error(res.error ?? "Could not add blackout")
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeBlackout(id)
      if (res.ok) toast.success("Blackout removed")
      else toast.error(res.error ?? "Could not remove")
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
          <CalendarOff className="h-4 w-4" />
        </span>
        <h2 className="font-display text-base font-bold text-foreground">Blackout Dates</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bo-start">Start date</Label>
          <Input id="bo-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bo-end">End date</Label>
          <Input id="bo-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="bo-reason">Reason (optional)</Label>
        <Input id="bo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Fleet maintenance" />
      </div>
      <Button onClick={add} disabled={pending} className="mt-3 w-full">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Block dates
      </Button>

      <div className="mt-4 space-y-2">
        {blackouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blackout dates set.</p>
        ) : (
          blackouts.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {b.startDate === b.endDate ? b.startDate : `${b.startDate} → ${b.endDate}`}
                </p>
                {b.reason && <p className="truncate text-xs text-muted-foreground">{b.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(b.id)}
                disabled={pending}
                className="ml-2 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove blackout"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function SlotManager({ slots }: { slots: SlotSetting[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
          <Clock className="h-4 w-4" />
        </span>
        <h2 className="font-display text-base font-bold text-foreground">Time-Slot Capacity</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Max cars per slot. Slots fill up and show as sold out on the storefront automatically.
      </p>
      <div className="space-y-2">
        {slots.map((s) => (
          <SlotRow key={s.slot} slot={s} />
        ))}
      </div>
    </section>
  )
}

function SlotRow({ slot }: { slot: SlotSetting }) {
  const [capacity, setCapacity] = useState(String(slot.capacity))
  const [active, setActive] = useState(slot.isActive)
  const [pending, startTransition] = useTransition()

  const dirty = Number(capacity) !== slot.capacity || active !== slot.isActive

  function save() {
    startTransition(async () => {
      const res = await updateSlot(slot.slot, Number(capacity), active)
      if (res.ok) toast.success(`${slot.slot} updated`)
      else toast.error(res.error ?? "Could not update")
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="w-20 shrink-0 text-sm font-medium text-foreground">{slot.slot}</span>
      <Input
        type="number"
        min={0}
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        className="h-8 w-16"
        aria-label={`Capacity for ${slot.slot}`}
      />
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`Toggle ${slot.slot}`}
        onClick={() => setActive((a) => !a)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          active ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
            active ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <Button size="sm" variant={dirty ? "default" : "outline"} onClick={save} disabled={pending || !dirty} className="ml-auto h-8">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  )
}
