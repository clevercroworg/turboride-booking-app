"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AsYouType, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

/** Convert an ISO 3166-1 alpha-2 code into its flag emoji via regional indicator symbols. */
function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

type Country = { iso: CountryCode; name: string; dial: string }

const DEFAULT_COUNTRY: CountryCode = "IN"

export function PhoneInput({
  value,
  onChange,
  id,
  placeholder = "98765 43210",
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
}) {
  // Full, accurate country dataset derived from libphonenumber-js metadata.
  const countries = useMemo<Country[]>(() => {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
    return getCountries()
      .map((iso) => ({
        iso,
        dial: `+${getCountryCallingCode(iso)}`,
        name: regionNames.of(iso) ?? iso,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY)
  const [national, setNational] = useState("")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)

  // If the parent clears the value (e.g. form reset), reset the local number too.
  useEffect(() => {
    if (!value) setNational("")
  }, [value])

  // Focus the search box when the dropdown opens.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const selected = countries.find((c) => c.iso === country)

  function emit(nextCountry: CountryCode, nextNational: string) {
    const digits = nextNational.replace(/\D/g, "")
    onChange(digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : "")
  }

  function handleNationalChange(raw: string) {
    // Format as the user types, respecting the selected country's numbering plan.
    const formatted = new AsYouType(country).input(raw)
    setNational(formatted)
    emit(country, formatted)
  }

  function selectCountry(next: CountryCode) {
    setCountry(next)
    setOpen(false)
    setQuery("")
    emit(next, national)
    numberRef.current?.focus()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries
    const normalizedDial = q.replace(/^\+/, "")
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.replace("+", "").startsWith(normalizedDial),
    )
  }, [countries, query])

  return (
    <div ref={wrapRef} className="relative mt-1.5">
      <div className="flex h-10 w-full items-center rounded-md border border-input bg-background text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country code: ${selected?.name ?? country} ${selected?.dial ?? ""}`}
          className="flex h-full items-center gap-1.5 rounded-l-md border-r border-input px-3 text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="text-base leading-none" aria-hidden="true">
            {selected ? flagEmoji(selected.iso) : "🏳️"}
          </span>
          <span className="tabular-nums text-muted-foreground">{selected?.dial}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <input
          id={id}
          ref={numberRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => handleNationalChange(e.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 rounded-r-md bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-72 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No countries found</li>
            )}
            {filtered.map((c) => {
              const isSel = c.iso === country
              return (
                <li key={c.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => selectCountry(c.iso)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-accent",
                      isSel && "bg-accent",
                    )}
                  >
                    <span className="text-base leading-none" aria-hidden="true">
                      {flagEmoji(c.iso)}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{c.dial}</span>
                    {isSel && <Check className="h-4 w-4 text-primary" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
