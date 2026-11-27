import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { isPlatformOwner } from '../lib/owner-access'

const owner = 'af21722f-c37c-47b4-8517-d894ee681be8'
const member = '73f9ee44-0cc1-4284-b5f3-75f480072f58'

test('owner access requires the single configured Auth UID and a permanent account', (t) => {
  const saved = process.env.OWNER_USER_ID
  t.after(() => {
    if (saved === undefined) delete process.env.OWNER_USER_ID
    else process.env.OWNER_USER_ID = saved
  })
  for (const setting of ['', 'owner@example.test', owner + ',' + member]) {
    process.env.OWNER_USER_ID = setting
    assert.equal(isPlatformOwner({ id: owner }), false)
  }
  process.env.OWNER_USER_ID = owner.toUpperCase()
  assert.equal(isPlatformOwner({ id: member }), false)
  assert.equal(isPlatformOwner({ id: owner, is_anonymous: true }), false)
  assert.equal(isPlatformOwner({ id: owner }), true)
})

test('the dashboard checks the identity returned by Auth before serving the document', async (t) => {
  const settings = {
    OWNER_USER_ID: owner,
    NEXT_PUBLIC_SUPABASE_URL: 'https://owner-check.test',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-key',
  }
  const saved = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]))
  Object.assign(process.env, settings)
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  let verifiedId = member
  const authRequests: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    authRequests.push(url)
    return Response.json({ id: verifiedId, aud: 'authenticated', role: 'authenticated' })
  })
  const dashboard = 'https://clientfind.test/app/admin?q=private%40example.test'
  const signedOut = await middleware(new NextRequest(dashboard))
  const login = new URL(signedOut.headers.get('location')!)
  assert.equal(login.pathname, '/auth/login')
  assert.equal(login.searchParams.get('next'), '/app/admin')

  const session = Buffer.from(JSON.stringify({
    access_token: 'fixture-access', refresh_token: 'fixture-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: owner },
  })).toString('base64url')
  const headers = { cookie: 'sb-owner-check-auth-token=base64-' + session }
  const denied = await middleware(new NextRequest(dashboard, { headers }))
  assert.equal(denied.status, 404)
  assert.match(denied.headers.get('Cache-Control') ?? '', /no-store/)
  assert.doesNotMatch(await denied.text(), /example.test/)
  verifiedId = owner
  const allowed = await middleware(new NextRequest(dashboard, { headers }))
  assert.equal(allowed.status, 200)
  assert.match(allowed.headers.get('Cache-Control') ?? '', /no-store/)
  assert.ok(authRequests.length >= 2)
  assert.ok(authRequests.every(url => url === 'https://owner-check.test/auth/v1/user'))
})
