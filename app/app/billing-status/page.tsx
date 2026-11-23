import Link from 'next/link'
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  const pending = (await searchParams).setup === 'pending'
  return (
    <>
      <h1>Checkout is unavailable</h1>
      <p>
        {pending
          ? 'Payments will be available when the workspace owner connects Stripe.'
          : 'Check your current plan in settings. Limited-time prices close when the offer ends and can be temporarily reserved by other buyers.'}
      </p>
      <Link href="/app/settings">Review your plan</Link>
      <p>
        <Link href="/pricing">See available offers</Link>
      </p>
    </>
  )
}
