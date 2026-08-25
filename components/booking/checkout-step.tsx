"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/booking/phone-input"
import { formatINR, type Car } from "@/lib/turboride/fleet"
import { type PaymentOption, type PriceBreakdown, VENUE_ADVANCE } from "@/lib/turboride/pricing"
import { BadgePercent, Wallet, Check } from "lucide-react"

export type Contact = { name: string; email: string; phone: string }

export function CheckoutStep({
  contact,
  onContactChange,
  payment,
  onPaymentChange,
  price,
  car,
}: {
  contact: Contact
  onContactChange: (c: Contact) => void
  payment: PaymentOption
  onPaymentChange: (p: PaymentOption) => void
  price: PriceBreakdown
  car: Car
}) {
  const options: {
    id: PaymentOption
    title: string
    desc: string
    icon: typeof Wallet
  }[] = [
    {
      id: "full",
      title: "Pay in full online",
      desc: `Unlock ${price.discountRate ? `${Math.round(price.discountRate * 100)}%` : "an"} instant discount and pay everything now.`,
      icon: BadgePercent,
    },
    {
      id: "venue",
      title: "Pay advance, rest at venue",
      desc: `Pay ${formatINR(VENUE_ADVANCE)} advance now, balance at the venue on drive day. No discount applies.`,
      icon: Wallet,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-display text-base font-bold text-foreground">Your details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={contact.name}
              onChange={(e) => onContactChange({ ...contact, name: e.target.value })}
              placeholder="Ayrton Senna"
              className="mt-1.5"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={contact.email}
              onChange={(e) => onContactChange({ ...contact, email: e.target.value })}
              placeholder="you@example.com"
              className="mt-1.5"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <PhoneInput
              id="phone"
              value={contact.phone}
              onChange={(phone) => onContactChange({ ...contact, phone })}
              placeholder="98765 43210"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-base font-bold text-foreground">Payment option</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((opt) => {
            const selected = payment === opt.id
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPaymentChange(opt.id)}
                aria-pressed={selected}
                className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                  selected ? "border-primary bg-accent ring-2 ring-primary/25" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {selected && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
                <Icon className="h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">{opt.title}</p>
                <p className="text-sm text-muted-foreground">{opt.desc}</p>
              </button>
            )
          })}
        </div>
        {payment === "full" && price.discount > 0 && (
          <p className="rounded-lg bg-success-muted px-3 py-2 text-sm font-medium text-success">
            You save {formatINR(price.discount)} by paying in full online.
          </p>
        )}
        {payment === "venue" && (
          <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground">
            Pay {formatINR(price.payNow)} advance now to lock your slot. The remaining{" "}
            {formatINR(price.balanceAtVenue)} is due at the venue.{" "}
            <span className="text-muted-foreground">No full-payment discount applies to this option.</span>
          </p>
        )}
      </div>
    </div>
  )
}
