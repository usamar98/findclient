import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { isBillingOrigin } from '../lib/origin'

test('retired checkout links send visitors to current pricing before sign-in', async () => {
  for (const plan of ['free', 'monthly']) {
    const response = await middleware(new NextRequest('https://clientfind.test/app/checkout/' + plan))
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'https://clientfind.test/pricing')
  }
})

test('billing POSTs behind a proxy require the configured production or preview origin', (t) => {
  const variables = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_URL', 'VERCEL_ENV'] as const
  const previous = variables.map((name) => process.env[name])
  t.after(() => variables.forEach((name, i) => {
    if (previous[i] === undefined) delete process.env[name]
    else process.env[name] = previous[i]
  }))
  process.env.NEXT_PUBLIC_SITE_URL = 'https://clientfind.test'
  process.env.VERCEL_URL = 'preview.clientfind.test'
  process.env.VERCEL_ENV = 'production'
  const check = (origin?: string) => isBillingOrigin(new Request('http://localhost:3117/api/checkout', {
    method: 'POST', headers: origin ? {origin} : {},
  }))
  assert.ok(check('https://clientfind.test'))
  assert.equal(check('http://localhost:3117'), false)
  assert.equal(check('https://other.test'), false)
  assert.equal(check(), false)
  process.env.VERCEL_ENV = 'preview'
  assert.ok(check('https://preview.clientfind.test'))
  assert.equal(check('https://clientfind.test'), false)
})

test('redirects only the configured host alias and preserves the requested path and query', async (t) => {
  const previous = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.NEXT_PUBLIC_SITE_URL = 'https://clientfind.test'
  process.env.VERCEL_ENV = 'production'
  const request = (host: string) =>
    new NextRequest('http://localhost:3078/pricing?plan=agency', { headers: { host } })

  const response = await middleware(request('www.clientfind.test:443'))
  assert.equal(response.status, 301)
  assert.equal(response.headers.get('location'), 'https://clientfind.test/pricing?plan=agency')
  assert.equal((await middleware(request('clientfind.test'))).status, 200)
  assert.equal((await middleware(request('other.test'))).status, 200)
  process.env.VERCEL_ENV = 'preview'
  assert.equal((await middleware(request('www.clientfind.test'))).status, 200)
})
