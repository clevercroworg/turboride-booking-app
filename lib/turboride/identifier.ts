export type Channel = "email" | "sms"

/** Normalize a raw email/phone into a canonical identifier + delivery channel. */
export function normalizeIdentifier(raw: string): { identifier: string; channel: Channel } | null {
  const value = raw.trim()
  if (!value) return null
  if (value.includes("@")) {
    const email = value.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    return { identifier: email, channel: "email" }
  }
  const digits = value.replace(/\D/g, "")
  if (digits.length < 10) return null
  // Match on the last 10 digits so "+91 98765 43210" and "9876543210" resolve to the same account.
  return { identifier: digits.slice(-10), channel: "sms" }
}

export function classifyIdentifier(identifier: string): Channel {
  return identifier.includes("@") ? "email" : "sms"
}

/** WHERE fragment + param ($1) that matches a booking row to an identifier. */
export function bookingMatchClause(identifier: string): { clause: string; param: string } {
  if (classifyIdentifier(identifier) === "email") {
    return { clause: "lower(customer_email) = $1", param: identifier }
  }
  return {
    clause: "right(regexp_replace(customer_phone, '\\D', '', 'g'), 10) = $1",
    param: identifier,
  }
}
