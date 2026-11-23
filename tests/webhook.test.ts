import { test } from 'node:test'
import assert from 'node:assert/strict'
import Stripe from 'stripe'
import {
  verifyEvent,
  paidCheckout,
  monthlyInvoice,
  type PaymentDetails,
} from '../lib/payments'
test('Stripe verification authenticates the exact bytes', () => {
  const payload = JSON.stringify({
      id: 'evt_fixture',
      type: 'checkout.session.completed',
    }),
    secret = 'test_webhook_fixture'
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret })
  assert.equal(verifyEvent(payload, header, secret).id, 'evt_fixture')
  assert.throws(() => verifyEvent(payload + ' ', header, secret))
})

test('paid subscription invoices identify the quote and exclude unrelated invoices and prorations', () => {
  const quote = crypto.randomUUID()
  const line = {
    amount: 4900,
    period: { start: 1764547200, end: 1767225600 },
    parent: {
      subscription_item_details: { subscription: 'sub_test', proration: false },
    },
  }
  const invoice = {
    id: 'in_test',
    status: 'paid',
    currency: 'usd',
    billing_reason: 'subscription_cycle',
    customer: 'cus_test',
    parent: {
      subscription_details: {
        subscription: 'sub_test',
        metadata: { app: 'clientfind', product: 'monthly', quote },
      },
    },
    lines: { data: [line] },
  } as unknown as Stripe.Invoice
  assert.deepEqual(monthlyInvoice(invoice), {
    p_quote: quote,
    p_invoice: 'in_test',
    p_customer: 'cus_test',
    p_subscription: 'sub_test',
    p_amount: 4900,
    p_period_end: new Date(line.period.end * 1000).toISOString(),
  })
  assert.equal(monthlyInvoice({ ...invoice, status: 'open' }), null)
  assert.equal(monthlyInvoice({ ...invoice, parent: null }), null)
  assert.equal(
    monthlyInvoice({ ...invoice, billing_reason: 'subscription_update' }),
    null,
  )
  line.parent.subscription_item_details.proration = true
  assert.throws(
    () => monthlyInvoice(invoice),
    /Incomplete subscription invoice/,
  )
})
test('fulfillment requires a paid USD checkout with account and quote IDs', () => {
  const session = {
    mode: 'payment',
    payment_status: 'unpaid',
    currency: 'usd',
    client_reference_id: crypto.randomUUID(),
    metadata: { quote: crypto.randomUUID() },
    id: 'cs_fixture',
    amount_total: 9900,
    customer: 'cus_fixture',
  } satisfies PaymentDetails
  assert.equal(paidCheckout(session), null)
  assert.equal(
    paidCheckout({ ...session, payment_status: 'paid' })?.p_amount,
    9900,
  )
  assert.throws(() =>
    paidCheckout({ ...session, payment_status: 'paid', currency: 'eur' }),
  )
})
