import Link from 'next/link'
import { LIFETIME_ENDS_AT } from '@/lib/offers'
import { softwareApplication } from '@/lib/brand'
import { getOffers, getPricing } from '@/lib/pricing'
import { absolute } from '@/lib/seo'
import { LifetimeOffer } from './lifetime-offer'
import { JsonLd } from './seo'
import './offers.css'

export async function Offers({ full = false }: { full?: boolean }) {
  const [offers, tier] = await Promise.all([getOffers(), getPricing()])
  const lifetime = offers.find(offer => offer.product === 'lifetime')!
  const packs = offers.filter(offer => offer.product.startsWith('topup'))
  const now = Date.now()
  const hasLivePrice = tier.sales !== null && lifetime.price !== null
  const Title = full ? 'h1' : 'h2'
  const publishedOffers = [
    ...(hasLivePrice && now < Date.parse(LIFETIME_ENDS_AT)
      ? [{ name: 'Lifetime deal', price: lifetime.price, validThrough: LIFETIME_ENDS_AT }]
      : []),
    ...(full ? packs.filter(pack => pack.price !== null).map(pack => ({
      name: pack.credits + ' credits',
      price: pack.price,
    })) : []),
  ].map(offer => ({ '@type': 'Offer', ...offer, priceCurrency: 'USD', url: absolute('/pricing') }))

  return (
    <section className={`cf-offers${full ? ' cf-offers-page' : ''}`} aria-labelledby="cf-plans-title">
      <div className="cf-plans-intro">
        <Title id="cf-plans-title">One payment for lifetime access</Title>
        {full && (
          <p>Live Research uses no scoring credits. Browse contracts on We Work Remotely and Remote OK, GitHub paid bounties and Mastodon hiring posts. <Link href="/platforms">See all 12 sources</Link>.</p>
        )}
      </div>
      <LifetimeOffer
        price={lifetime.price}
        credits={lifetime.credits}
        sales={hasLivePrice ? tier.sales : null}
        spots={tier.price === lifetime.price ? tier.spots : null}
        now={now}
      />
      {full && (
        <div className="cf-credit-packs">
          <div>
            <h2>Credit packs</h2>
            <p>Scoring a request or generating a reply uses one credit. Add more with a one-time purchase.</p>
          </div>
          <div className="cf-pack-list">
            {packs.map(pack => (
              <form action="/api/checkout" method="post" key={pack.product}>
                <input type="hidden" name="product" value={pack.product} />
                <button disabled={pack.price === null} aria-label={`Buy ${pack.credits} credits${pack.price === null ? '' : ' for $' + pack.price}`}>
                  <span>{pack.credits} credits</span><strong>{pack.price === null ? 'Unavailable' : '$' + pack.price}</strong>
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
      <JsonLd data={{
        '@context': 'https://schema.org',
        ...softwareApplication,
        ...(publishedOffers.length ? { offers: publishedOffers } : {}),
      }} />
    </section>
  )
}
