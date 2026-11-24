import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { canonicalOrigin, searchIndexingEnabled, siteOrigin } from '../lib/origin'
import { buildMetadata } from '../lib/seo'

test('public metadata points to the branded domain, including share cards and feeds', () => {
  const metadata = buildMetadata({
    title: 'Agency pricing',
    description: 'Lifetime access for an agency workspace.',
    path: '/pricing',
  })
  assert.equal(metadata.alternates?.canonical, 'https://leadtoclient.app/pricing')
  assert.equal(metadata.openGraph?.url, metadata.alternates?.canonical)
  assert.equal(metadata.openGraph?.siteName, 'Lead To Client')
  assert.equal(metadata.alternates?.types?.['application/rss+xml'], canonicalOrigin + '/rss.xml')
})

test('production aliases consolidate on the public domain and preview callbacks stay on the preview', async (t) => {
  const keys = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_URL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL'] as const
  const previous = keys.map((key) => process.env[key])
  t.after(() => keys.forEach((key, index) => {
    const value = previous[index]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }))
  delete process.env.NEXT_PUBLIC_SITE_URL
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_URL = 'example-deploy.vercel.app'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'example-project.vercel.app'
  assert.equal(siteOrigin(), canonicalOrigin)
  assert.equal(searchIndexingEnabled(), true)
  for (const host of ['www.leadtoclient.app', process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    const response = await middleware(new NextRequest('https://' + host + '/blog?q=pricing', { headers: { host } }))
    assert.equal(response.status, 301)
    assert.equal(response.headers.get('location'), canonicalOrigin + '/blog?q=pricing')
  }
  process.env.VERCEL_ENV = 'preview'
  assert.equal(siteOrigin(), 'https://example-deploy.vercel.app')
  assert.equal(searchIndexingEnabled(), false)
  const response = await middleware(new NextRequest('https://example-deploy.vercel.app/pricing'))
  assert.equal(response.status, 200)
})
