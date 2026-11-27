import test from 'node:test'
import assert from 'node:assert/strict'
import { billingLocation, recordBillingLocation } from '../lib/billing-location'

test('billing location retains only city and country from a transaction snapshot', () => {
  const address = {
    city: '  São Paulo  ',
    country: 'br',
    line1: 'Street',
    postal_code: '12345',
  }
  assert.deepEqual(billingLocation(address), {
    city: 'São Paulo',
    country: 'BR',
  })
  assert.deepEqual(billingLocation({ city: ' ', country: 'Brazil' }), {
    city: null,
    country: null,
  })
})

test('a second address from the same payment can fill a missing city only when compatible', () => {
  const snapshot = { country: 'DE' }
  assert.deepEqual(billingLocation(snapshot, { city: 'Bonn', country: 'DE' }), {
    city: 'Bonn',
    country: 'DE',
  })
  assert.deepEqual(
    billingLocation(snapshot, { city: 'Paris', country: 'FR' }),
    { city: null, country: 'DE' },
  )
})

test('record only available location evidence and surface storage errors for webhook retry', async () => {
  const writes: unknown[] = []
  let fail = true
  const db = {
    async rpc(...args: unknown[]) {
      writes.push(args)
      return { error: fail ? new Error('unavailable') : null }
    },
  } as unknown as Parameters<typeof recordBillingLocation>[0]

  await recordBillingLocation(db, 'cs_fixture', billingLocation(null))
  assert.equal(writes.length, 0)

  const location = billingLocation({ country: 'pk' })
  await assert.rejects(
    recordBillingLocation(db, 'in_fixture', location),
    /Purchase location pending/,
  )
  fail = false
  await recordBillingLocation(db, 'in_fixture', location)
  assert.deepEqual(writes[1], [
    'record_purchase_location',
    {
      p_receipt: 'in_fixture',
      p_city: null,
      p_country: 'PK',
    },
  ])
})

test('a pending location migration does not interrupt already settled checkout events', async () => {
  const db = { rpc: async () => ({ error: {
    code: 'PGRST202', message: 'Could not find the function public.record_purchase_location(p_city, p_country, p_receipt) in the schema cache',
  } }) } as unknown as Parameters<typeof recordBillingLocation>[0]
  await recordBillingLocation(db, 'cs_fixture', billingLocation({ city: 'Porto', country: 'PT' }))
})
