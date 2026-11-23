import 'server-only'
import type Stripe from 'stripe'
import { admin } from './db/admin'
import {
  monthlyInvoice,
  paidCheckout,
  stripe,
  productNames,
  type products,
} from './payments'
import { LIFETIME_ENDS_AT } from './offers'
import { siteOrigin } from './origin'
import type { z } from 'zod'
type Product = z.infer<typeof products>
type Quote = {
  id: string
  user_id: string
  product: Product
  amount: number
  expires_at: string
}
export async function fulfill(s: Stripe.Checkout.Session) {
  if (s.mode === 'subscription' && s.metadata?.product === 'monthly') {
    if (s.payment_status === 'paid' && s.invoice) {
      const invoice =
        typeof s.invoice === 'string'
          ? await stripe().invoices.retrieve(s.invoice)
          : s.invoice
      await applyInvoice(invoice)
    }
    return
  }
  const payment = paidCheckout(s)
  if (!payment) return
  const { currency, ...args } = payment
  if (currency === 'usd') {
    const { error } = await admin().rpc('fulfill_checkout', args)
    if (error) throw new Error('Payment fulfillment pending')
  }
}
async function applyInvoice(invoice: Stripe.Invoice) {
  const args = monthlyInvoice(invoice)
  if (!args) return
  const { error } = await admin().rpc('apply_subscription_invoice', args)
  if (error) throw new Error('Subscription refill pending')
}
async function expireQuote(id: string) {
  const { error } = await admin()
    .from('checkout_quotes')
    .update({ state: 'expired' })
    .eq('id', id)
    .eq('state', 'open')
  if (error) throw error
}
export async function handleStripeEvent(event: Stripe.Event) {
  if (event.type === 'invoice.paid') await applyInvoice(event.data.object)
  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object
    if (
      sub.metadata.app === 'clientfind' &&
      sub.metadata.product === 'monthly' &&
      (sub.status === 'canceled' || sub.status === 'incomplete_expired')
    ) {
      const { error } = await admin().rpc('end_subscription', {
        p_quote: sub.metadata.quote,
        p_subscription: sub.id,
        p_customer:
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      })
      if (error) throw new Error('Subscription update pending')
    }
  }
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    if (event.data.object.metadata?.app === 'clientfind')
      await fulfill(event.data.object)
  }
  if (
    event.type === 'checkout.session.expired' &&
    event.data.object.metadata?.app === 'clientfind' &&
    event.data.object.metadata.quote
  )
    await expireQuote(event.data.object.metadata.quote)
}
export async function startCheckout(
  userId: string,
  email: string,
  product: Product,
) {
  if (product === 'lifetime' && Date.now() >= Date.parse(LIFETIME_ENDS_AT))
    return null
  const db = admin(),
    api = stripe()
  const profile = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()
  if (profile.error) throw profile.error
  let customer = profile.data.stripe_customer_id
  if (!customer) {
    const created = await api.customers.create(
      { email, metadata: { user_id: userId } },
      { idempotencyKey: 'customer-' + userId },
    )
    const { error } = await db
      .from('profiles')
      .update({ stripe_customer_id: created.id })
      .eq('id', userId)
      .is('stripe_customer_id', null)
    if (error) throw error
    const confirmed = await db
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()
    if (confirmed.error) throw confirmed.error
    customer = confirmed.data.stripe_customer_id
  }
  if (!customer) throw new Error('Customer account unavailable')
  const open = await db
    .from('checkout_quotes')
    .select('*')
    .eq('user_id', userId)
    .eq('product', product)
    .eq('state', 'open')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle<Quote>()
  if (open.error) throw open.error
  let quote = open.data
  if (quote) {
    const found = await priorSession(customer, quote)
    if (found?.status === 'open' && found.url) return found.url
    if (found?.payment_status === 'paid') {
      await fulfill(found)
      return siteOrigin() + '/app/settings'
    }
    if (
      found?.status === 'expired' ||
      (!found && Date.parse(quote.expires_at) < Date.now() - 120000)
    ) {
      await expireQuote(quote.id)
      quote = null
    }
  }
  if (!quote) {
    const { data, error } = await db
      .rpc('create_quote', { p_user: userId, p_product: product })
      .single<Quote>()
    if (error || !data) return null
    quote = data
  }
  const expiry = Math.floor(Date.parse(quote.expires_at) / 1000)
  if (expiry < Date.now() / 1000 + 1800) return null
  const metadata = { app: 'clientfind', quote: quote.id, product }
  const session = await api.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      customer,
      client_reference_id: userId,
      metadata,
      expires_at: expiry,
      invoice_creation: { enabled: true },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: quote.amount,
            product_data: { name: 'Clientfind · ' + productNames[product] },
          },
        },
      ],
      success_url: siteOrigin() + '/app/settings?checkout=complete',
      cancel_url: siteOrigin() + '/pricing',
    },
    { idempotencyKey: 'checkout-' + quote.id },
  )
  return session.url
}
async function priorSession(
  customer: string,
  quote: Pick<Quote, 'id' | 'expires_at'>,
) {
  const since = Math.floor(Date.parse(quote.expires_at) / 1000) - 2160
  for await (const s of stripe().checkout.sessions.list({
    customer,
    created: { gte: since, lte: since + 2400 },
    limit: 100,
  })) {
    if (s.metadata?.quote === quote.id) return s
  }
  return null
}
export async function reconcileQuotes() {
  const db = admin(),
    { data, error } = await db
      .from('checkout_quotes')
      .select('*,profiles(stripe_customer_id)')
      .eq('state', 'open')
      .lt('expires_at', new Date(Date.now() - 120000).toISOString())
      .order('expires_at')
      .limit(75)
  if (error) throw error
  for (const q of data) {
    const customer = q.profiles?.stripe_customer_id
    if (!customer) continue
    const s = await priorSession(customer, q)
    if (s?.payment_status === 'paid') await fulfill(s)
    else if (!s || s.status === 'expired') await expireQuote(q.id)
  }
}
