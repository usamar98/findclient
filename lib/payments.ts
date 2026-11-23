import Stripe from 'stripe'
import { z } from 'zod'
export const products = z.enum([
  'lifetime',
  'monthly',
  'topup9',
  'topup19',
  'topup29',
])
export const productNames = {
  lifetime: 'Lifetime deal',
  monthly: 'Monthly subscription',
  topup9: '100 credits',
  topup19: '250 credits',
  topup29: '400 credits',
}
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured')
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 12000 })
}
export function verifyEvent(raw: string, signature: string, secret: string) {
  return Stripe.webhooks.constructEvent(raw, signature, secret)
}
export type PaymentDetails = Pick<
  Stripe.Checkout.Session,
  | 'mode'
  | 'payment_status'
  | 'client_reference_id'
  | 'metadata'
  | 'id'
  | 'amount_total'
  | 'customer'
  | 'currency'
>
export function paidCheckout(s: PaymentDetails) {
  if (s.mode !== 'payment' || s.payment_status !== 'paid') return null
  return z
    .object({
      p_quote: z.uuid(),
      p_user: z.uuid(),
      p_session: z.string().min(1),
      p_amount: z.number().int().positive(),
      p_customer: z.string().min(1),
      currency: z.literal('usd'),
    })
    .parse({
      p_quote: s.metadata?.quote,
      p_user: s.client_reference_id,
      p_session: s.id,
      p_amount: s.amount_total,
      p_customer: typeof s.customer === 'string' ? s.customer : s.customer?.id,
      currency: s.currency,
    })
}

export function monthlyInvoice(invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details
  if (
    details?.metadata?.app !== 'clientfind' ||
    details.metadata.product !== 'monthly'
  )
    return null
  if (
    invoice.status !== 'paid' ||
    !['subscription_create', 'subscription_cycle'].includes(
      invoice.billing_reason ?? '',
    )
  )
    return null
  if (invoice.currency !== 'usd')
    throw new Error('Unexpected subscription currency')
  const subscription =
    typeof details.subscription === 'string'
      ? details.subscription
      : details.subscription.id
  const line = invoice.lines.data.find((line) => {
    const item = line.parent?.subscription_item_details
    return item?.subscription === subscription && !item.proration
  })
  if (!invoice.id || !line || !details.metadata.quote || !invoice.customer)
    throw new Error('Incomplete subscription invoice')
  return {
    p_quote: details.metadata.quote,
    p_invoice: invoice.id,
    p_subscription: subscription,
    p_customer:
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer.id,
    p_amount: line.amount,
    p_period_end: new Date(line.period.end * 1000).toISOString(),
  }
}
