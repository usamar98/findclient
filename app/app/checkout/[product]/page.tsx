import { notFound } from 'next/navigation'
import Link from 'next/link'
import { products, productNames } from '@/lib/payments'
import { getPricing } from '@/lib/pricing'
import { admin } from '@/lib/db/admin'
import { LIFETIME_ENDS_AT } from '@/lib/offers'
export default async function Checkout({
  params,
}: {
  params: Promise<{ product: string }>
}) {
  const selection = products.safeParse((await params).product)
  if (!selection.success) notFound()
  const product = selection.data
  if (product === 'lifetime' && Date.now() >= Date.parse(LIFETIME_ENDS_AT))
    return (
      <section className="panel">
        <h1>The lifetime deal has ended</h1>
        <Link href="/pricing">View pricing</Link>
      </section>
    )
  const { data: offer, error } = await admin()
    .from('product_config')
    .select('credits,price_cents')
    .eq('product', product)
    .single()
  if (error) throw new Error('Offer unavailable')
  const price =
    product === 'lifetime'
      ? (await getPricing()).price
      : offer.price_cents / 100
  return (
    <>
      <h1>Review your purchase</h1>
      <section className="panel">
        <h2>{productNames[product]}</h2>
        <p>
          {price === null
            ? 'Current price unavailable'
            : '$' + price + ' USD · One-time payment'}
        </p>
        <p>
          {offer.credits} credits{' '}
          {product === 'lifetime'
            ? 'included each month'
            : 'added to your balance'}
          .
        </p>
        <form method="post" action="/api/checkout">
          <input name="product" type="hidden" value={product} />
          <button disabled={price === null}>Continue to Stripe Checkout</button>
        </form>
      </section>
      <Link href="/pricing">View pricing</Link>
    </>
  )
}
