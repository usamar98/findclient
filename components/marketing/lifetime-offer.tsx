import type { CSSProperties } from 'react'
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
      <LifetimeCheckout available={price !== null} initialTime={now}>
        <div className="cf-lifetime-price">
          {sales === null && price !== null && <span>From</span>}
          <strong>{price === null ? '—' : '$' + price}</strong>
          <span>{price === null ? 'Price unavailable' : 'once'}</span>
        </div>
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
        <ul className="cf-lifetime-benefits">
          <li>{credits} credits at purchase and every month</li>
          <li>Hourly lead searches for one niche</li>
          <li>Buying intent, budget, and urgency signals</li>
          <li>Editable replies and a personal pitch</li>
        </ul>
      </LifetimeCheckout>
    </article>
  )
}
