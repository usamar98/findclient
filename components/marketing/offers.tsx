import Link from 'next/link'
import { LIFETIME_ENDS_AT } from '@/lib/offers'
import { getOffers, getPricing } from '@/lib/pricing'
import { absolute } from '@/lib/seo'
import { LifetimeCheckout } from './lifetime-checkout'
import { JsonLd } from './seo'
import './offers.css'

function Features({ items }: { items: string[] }) {
  return (
    <ul className="cf-plan-features">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  )
}

function Checkout({ product, label, disabled }: { product: string; label: string; disabled: boolean }) {
  return (
    <form action="/api/checkout" method="post">
      <input type="hidden" name="product" value={product} />
      <button className="cf-plan-action" disabled={disabled}>
        {disabled ? 'Currently unavailable' : label}<span aria-hidden="true">↗</span>
      </button>
    </form>
  )
}

export async function Offers({ full = false }: { full?: boolean }) {
  const [offers, tier] = await Promise.all([getOffers(), getPricing()])
  const monthly = offers.find(offer => offer.product === 'monthly')!
  const lifetime = offers.find(offer => offer.product === 'lifetime')!
  const packs = offers.filter(offer => offer.product.startsWith('topup'))
  const now = Date.now()
  const expired = now >= Date.parse(LIFETIME_ENDS_AT)
  const hasLivePrice = tier.sales !== null && lifetime.price !== null
  const Title = full ? 'h1' : 'h2'

  return (
    <section className={`cf-offers${full ? ' cf-offers-page' : ''}`} aria-labelledby="cf-plans-title">
      <div className="cf-plans-intro">
        <Title id="cf-plans-title">{full ? 'Clientfind pricing' : 'Choose your plan'}</Title>
        <p>Explore your niche with free credits. Go monthly for regular searches, or pay once for lifetime access.</p>
      </div>
      <div className="cf-plan-grid">
        <article className="cf-plan-card">
          <div className="cf-plan-heading">
            <h3>Free</h3>
            <span className="cf-plan-icon cf-icon-free" aria-hidden="true" />
          </div>
          <p className="cf-plan-purpose">Try Clientfind in your niche.</p>
          <div className="cf-plan-price"><strong>$0</strong><span>to start</span></div>
          <Features items={['15 starter credits', '1 niche with hourly discovery', 'Intent scores and editable replies']} />
          <div className="cf-plan-bottom">
            <Link className="cf-plan-action" href="/auth/login">Find your first 3 clients free<span aria-hidden="true">↗</span></Link>
          </div>
        </article>
        <article className="cf-plan-card">
          <div className="cf-plan-heading">
            <h3>Monthly</h3>
            <span className="cf-plan-icon cf-icon-monthly" aria-hidden="true" />
          </div>
          <p className="cf-plan-purpose">Keep your lead inbox refreshed.</p>
          <div className="cf-plan-price">
            <strong>{monthly.price === null ? '—' : '$' + monthly.price}</strong><span>/ month</span>
          </div>
          <Features items={[`${monthly.credits} credits per paid month`, '1 niche with hourly discovery', 'Manage your subscription in billing']} />
          <div className="cf-plan-bottom">
            <Checkout product="monthly" label="Start monthly" disabled={monthly.price === null} />
          </div>
        </article>
        <article className="cf-plan-card cf-plan-featured">
          <div className="cf-plan-heading">
            <h3>Lifetime deal</h3>
            <span className="cf-plan-icon cf-icon-lifetime" aria-hidden="true">∞</span>
          </div>
          <p className="cf-plan-purpose">One payment for ongoing discovery.</p>
          <div className="cf-plan-price">
            {!hasLivePrice && <span>From</span>}
            <strong>${lifetime.price ?? 149}</strong><span>once</span>
          </div>
          <Features items={[`${lifetime.credits} credits every month`, '1 niche with hourly discovery', 'Price rises $10 every 10 deals']} />
          {hasLivePrice && tier.price === lifetime.price && tier.spots !== null && !expired && <p className="cf-tier-note">{tier.spots} {tier.spots === 1 ? 'deal' : 'deals'} left at this price</p>}
          <LifetimeCheckout initialTime={now} available={lifetime.price !== null} />
        </article>
      </div>
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
        '@type': 'SoftwareApplication',
        '@id': absolute('/#app'),
        name: 'Clientfind', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: absolute('/'),
        offers: [
          { name: 'Free', price: 0 },
          ...(monthly.price !== null ? [{ name: 'Monthly', price: monthly.price,
            priceSpecification: { '@type': 'UnitPriceSpecification', price: monthly.price, priceCurrency: 'USD', billingDuration: 'P1M', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } } }] : []),
          ...(hasLivePrice && !expired ? [{ name: 'Lifetime deal', price: lifetime.price, validThrough: LIFETIME_ENDS_AT }] : []),
          ...(full ? packs.filter(pack => pack.price !== null).map(pack => ({ name: pack.credits + ' credits', price: pack.price })) : []),
        ].map(offer => ({ '@type': 'Offer', ...offer, priceCurrency: 'USD', url: absolute('/pricing') })),
      }} />
    </section>
  )
}
