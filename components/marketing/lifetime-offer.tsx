import type { CSSProperties } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { LifetimeCheckout } from './lifetime-checkout'

type LifetimeOfferProps = {
  price: number | null
  credits: number
  sales: number | null
  spots: number | null
  now: number
}

export function LifetimeOffer({ price, credits, sales, spots, now }: LifetimeOfferProps) {
  const currentTier = Math.floor((sales ?? 0) / 10)
  const firstTier = Math.max(0, currentTier - 2)
  return (
    <article id="lifetime-deal" className="cf-lifetime-offer" aria-label="Lifetime deal">
      <div className="cf-lifetime-summary">
        <p className="cf-lifetime-name">
          <BrandMark size={24} ink="var(--cf-bg)" tile="var(--cf-brand)" />
          Lead To Client
        </p>
        <div className="cf-lifetime-price">
          {sales === null && price !== null && <span>From</span>}
          <strong>{price === null ? '—' : '$' + price}</strong>
          <span>{price === null ? 'Price unavailable' : 'USD · one-time payment'}</span>
        </div>
        <ul className="cf-lifetime-benefits">
          <li>{credits} credits at purchase and every month</li>
          <li>Three service searches in a shared agency inbox</li>
          <li>Priority alerts and buyer scores with evidence</li>
          <li>Website audits and replies in your voice</li>
          <li>Branded proposals, follow-ups and won revenue</li>
        </ul>
      </div>
      <LifetimeCheckout available={price !== null} initialTime={now}>
        {price !== null && (
          <figure className="cf-lifetime-steps">
            <ol aria-label="Lifetime price tiers in US dollars">
              {Array.from({ length: 7 }, (_, step) => {
                const offset = firstTier + step - currentTier
                const amount = price + offset * 10
                const state = offset < 0 ? 'past' : offset === 0 ? 'current' : 'future'
                return (
                  <li key={amount} data-state={state} style={{ '--step': step } as CSSProperties}>
                    <span>${amount}</span><i aria-hidden="true" />
                    <span className="sr-only">{state === 'current' && sales === null ? 'Starting tier' : state + ' tier'}</span>
                  </li>
                )
              })}
            </ol>
            <figcaption>
              {sales !== null && spots !== null && <strong className="cf-remaining-deals">{spots} of 10 left at ${price}. </strong>}
              The price rises $10 after every 10 lifetime sales.
            </figcaption>
          </figure>
        )}
      </LifetimeCheckout>
    </article>
  )
}
