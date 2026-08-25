import type { Metadata } from "next"
import { Barlow, Kaushan_Script } from "next/font/google"
import { CarShowcase } from "@/components/car-carousel/car-showcase"

// Fonts scoped to this test page via CSS variables consumed by the .car-studio scope.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
})

const kaushan = Kaushan_Script({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-kaushan",
})

export const metadata: Metadata = {
  title: "Car Carousel — Test",
  description: "A dummy page to test the studio car showcase carousel.",
}

export default function CarCarouselTestPage() {
  return (
    <main
      className={`min-h-screen w-full overflow-x-hidden bg-studio ${barlow.variable} ${kaushan.variable}`}
    >
      <CarShowcase />
    </main>
  )
}
