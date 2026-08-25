import { redirect } from "next/navigation"

/**
 * The booking wizard lives on the home page, so /book jumps straight to the
 * booking section there.
 */
export default async function BookPage({ searchParams }: { searchParams?: Promise<{ car?: string }> }) {
  const params = await searchParams
  const car = params?.car
  if (car) {
    redirect(`/?car=${encodeURIComponent(car)}#book`)
  }
  redirect("/#book")
}
