"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckCircle2, Gift, ShieldAlert, User } from "lucide-react"

export type Eligibility = {
  age: boolean
  license: boolean
  automatic: boolean
}

/** Who the booking is for — decides how the eligibility questions are phrased. */
type PurchaseType = "self" | "gift"

// Questions are phrased for whoever will actually drive: first person when buying
// for yourself, third person ("the driver") when buying it as a gift.
const RULES: Record<PurchaseType, { key: keyof Eligibility; label: string }[]> = {
  self: [
    { key: "age", label: "I am at least 21 years of age" },
    { key: "license", label: "I hold a valid LMV driving license (1+ years)" },
    { key: "automatic", label: "I know how to drive an automatic car" },
  ],
  gift: [
    { key: "age", label: "The driver is at least 21 years of age" },
    { key: "license", label: "The driver holds a valid LMV driving license (1+ years)" },
    { key: "automatic", label: "The driver knows how to drive an automatic car" },
  ],
}

const PURCHASE_OPTIONS: { value: PurchaseType; label: string; icon: typeof User }[] = [
  { value: "self", label: "I'm buying this for myself", icon: User },
  { value: "gift", label: "I'm buying this as a gift", icon: Gift },
]

export function EligibilityStep({
  value,
  onChange,
}: {
  value: Eligibility
  onChange: (next: Eligibility) => void
}) {
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("self")
  const allChecked = value.age && value.license && value.automatic
  const rules = RULES[purchaseType]

  return (
    <div className="space-y-4">
      <fieldset className="rounded-xl border border-primary/20 bg-accent/60 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">Who is this experience for?</legend>
        <RadioGroup
          value={purchaseType}
          onValueChange={(v) => setPurchaseType(v as PurchaseType)}
          className="mt-1 grid gap-2.5 sm:grid-cols-2"
        >
          {PURCHASE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const selected = purchaseType === opt.value
            return (
              <label
                key={opt.value}
                className={`group flex cursor-pointer select-none items-center gap-3 rounded-lg border-2 bg-card px-4 py-3.5 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm ${
                  selected
                    ? "border-primary bg-accent ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50 hover:bg-accent/40"
                }`}
              >
                <RadioGroupItem value={opt.value} aria-label={opt.label} />
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    selected ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                  }`}
                />
                <span className="font-medium text-foreground">{opt.label}</span>
              </label>
            )
          })}
        </RadioGroup>
      </fieldset>

      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${
          allChecked
            ? "border-success/30 bg-success-muted text-success"
            : "border-warning/40 bg-warning-muted text-warning-foreground"
        }`}
        role="status"
        aria-live="polite"
      >
        {allChecked ? (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {purchaseType === "gift"
              ? "Driver eligible — this highway run is unlocked."
              : "Eligible to Drive — your highway run is unlocked."}
          </>
        ) : (
          <>
            <ShieldAlert className="h-5 w-5 shrink-0" />
            Eligibility Pending — confirm all three to continue.
          </>
        )}
      </div>

      <ul className="space-y-2.5">
        {rules.map((rule) => {
          const checked = value[rule.key]
          return (
            <li key={rule.key}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3.5 text-sm transition-colors ${
                  checked ? "border-primary/40 bg-accent" : "border-border hover:border-primary/30"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => onChange({ ...value, [rule.key]: c === true })}
                  aria-label={rule.label}
                />
                <span className="font-medium text-foreground">{rule.label}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
