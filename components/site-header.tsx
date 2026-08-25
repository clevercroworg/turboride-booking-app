import Link from "next/link"
import { Gauge } from "lucide-react"
import { getSessionIdentifier } from "@/app/actions/auth"
import { SiteNavMenu } from "@/components/site-nav-menu"

export async function SiteHeader() {
  const identifier = await getSessionIdentifier()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Gauge className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
            TURBO<span className="text-primary">RIDE</span>
          </span>
        </Link>
        <SiteNavMenu signedIn={Boolean(identifier)} />
      </div>
    </header>
  )
}
