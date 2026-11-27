import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { z } from 'zod'
import { billingLocation, recordBillingLocation } from '../lib/billing-location'
import type { Database } from '../lib/db/schema'
import { stripe } from '../lib/payments'

const usage =
  'tsx --env-file=.env.local scripts/backfill-purchase-locations.ts [--limit 50] [--after <purchase UUID>] [--apply]'

async function receiptLocation(api: Stripe, receipt: string) {
  if (receipt.startsWith('cs_')) {
    const session = await api.checkout.sessions.retrieve(receipt, {
      expand: ['payment_intent.latest_charge'],
    })
    if (session.payment_status !== 'paid') return null
    const intent = session.payment_intent
    const charge =
      typeof intent === 'object' && intent ? intent.latest_charge : null
    const address =
      typeof charge === 'object' && charge
        ? charge.billing_details.address
        : null
    return billingLocation(session.customer_details?.address, address)
  }
  if (receipt.startsWith('in_')) {
    const invoice = await api.invoices.retrieve(receipt)
    if (invoice.status === 'paid')
      return billingLocation(invoice.customer_address)
  }
  return null
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: 'boolean', default: false },
      limit: { type: 'string', default: '50' },
      after: { type: 'string' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }
  const limit = Number(values.limit)
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (values.after !== undefined && !z.uuid().safeParse(values.after).success)
  ) {
    console.error(usage)
    process.exitCode = 1
    return
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !process.env.STRIPE_SECRET_KEY) {
    console.error(
      'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and STRIPE_SECRET_KEY in the local environment.',
    )
    process.exitCode = 1
    return
  }
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const api = stripe()
  let cursor = values.after
  let complete = 0,
    available = 0,
    unavailable = 0
  try {
    let query = db
      .from('purchases')
      .select('id,stripe_session_id')
      .order('id')
      .limit(limit + 1)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) throw error
    const batch = data.slice(0, limit)
    if (!batch.length) {
      console.log('No more purchases in this pass.')
      return
    }
    const existing = await db
      .from('purchase_billing_locations')
      .select('stripe_session_id,city,country')
      .in(
        'stripe_session_id',
        batch.map((p) => p.stripe_session_id),
      )
    if (existing.error) throw existing.error
    const locations = new Map(
      existing.data.map((row) => [row.stripe_session_id, row]),
    )
    for (const purchase of batch) {
      const receipt = purchase.stripe_session_id
      const saved = locations.get(receipt)
      if (saved?.city && saved.country) {
        complete++
      } else {
        let location
        try {
          location = await receiptLocation(api, receipt)
        } catch (error) {
          if (
            !(error instanceof Stripe.errors.StripeError) ||
            error.code !== 'resource_missing'
          )
            throw error
        }
        const merged = billingLocation(saved, location)
        if (
          (!saved?.city && merged.city) ||
          (!saved?.country && merged.country)
        ) {
          if (values.apply) await recordBillingLocation(db, receipt, merged)
          available++
        } else {
          unavailable++
        }
      }
      cursor = purchase.id
    }
    console.log(
      `${values.apply ? 'Applied' : 'Dry run'}: ${batch.length} examined, ${complete} already complete, ${available} with new data, ${unavailable} without new data.`,
    )
    if (data.length > batch.length)
      console.log('Continue this pass with --after', cursor)
    else console.log('Reached the end of this pass.')
  } catch {
    console.error(
      'Batch stopped. Check the migration, network, Supabase and Stripe account access before retrying.',
    )
    if (cursor) console.error('Resume this pass with --after', cursor)
    process.exitCode = 1
  }
}

main().catch(() => {
  console.error(usage)
  process.exitCode = 1
})
