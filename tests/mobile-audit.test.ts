import assert from 'node:assert/strict'
import test from 'node:test'
import { mobileAudit, parseMobileAudit } from '../lib/site-audit/mobile'

const url = 'https://example.com/store'
const report = {
  requestedUrl: url,
  finalUrl: 'https://www.example.com/store/',
  configSettings: { formFactor: 'mobile' },
  categories: {
    performance: { score: 0.47 },
    seo: { score: 0.7 },
    accessibility: { score: 0.63 },
  },
  audits: {
    'largest-contentful-paint': {
      scoreDisplayMode: 'numeric',
      numericUnit: 'millisecond',
      numericValue: 4461,
    },
    'cumulative-layout-shift': {
      scoreDisplayMode: 'numeric',
      numericUnit: 'unitless',
      numericValue: 0.29,
    },
    'color-contrast': {
      score: 0,
      scoreDisplayMode: 'binary',
      details: { items: [{}, {}] },
    },
    'button-name': { score: 0, scoreDisplayMode: 'binary' },
    'document-title': { score: 0 },
    'meta-description': { score: 0 },
  },
}
test('mobile audit reports measured scores and one evidenced issue per category', () => {
  const result = parseMobileAudit({ lighthouseResult: report }, url)
  assert.ok(result)
  assert.deepEqual(
    [
      result.lcpMs,
      result.cls,
      result.performance,
      result.seo,
      result.accessibility,
    ],
    [4461, 0.29, 47, 70, 63],
  )
  assert.deepEqual(
    result.findings.map((f) => f.category),
    ['Speed', 'SEO', 'Design'],
  )
  assert.match(result.findings[0].evidence, /4\.5 seconds/)
  assert.match(result.findings[1].evidence, /page title/)
  assert.match(result.findings[2].evidence, /contrast \(2 items flagged\)/)
})
test('results must belong to the same normalized final page and mobile run', () => {
  for (const change of [
    { finalUrl: 'https://store.example.com/store' },
    { finalUrl: 'https://example.com/login' },
    { finalUrl: 'https://example.com/store?error=1' },
    { requestedUrl: 'https://different.com/store' },
    { finalDisplayedUrl: 'https://different.com/store' },
    { finalUrl: undefined },
    { configSettings: { formFactor: 'desktop' } },
    { runtimeError: { code: 'NO_LCP' } },
  ])
    assert.equal(
      parseMobileAudit({ lighthouseResult: { ...report, ...change } }, url),
      null,
    )
  assert.equal(
    parseMobileAudit({ error: { code: 429 }, lighthouseResult: report }, url),
    null,
  )
  assert.equal(
    parseMobileAudit({ lighthouseResult: report }, 'https://localhost/'),
    null,
  )
})
test('partial measurements remain distinct from invalid, manual and passing checks', () => {
  const comparable = { requestedUrl: url, finalUrl: url }
  const result = parseMobileAudit(
    {
      lighthouseResult: {
        ...comparable,
        categories: { performance: { score: 0 }, seo: { score: 99 } },
        audits: {
          'cumulative-layout-shift': { numericValue: 0 },
          'largest-contentful-paint': {
            numericUnit: 'second',
            numericValue: 5,
          },
          'color-contrast': { score: 0, scoreDisplayMode: 'error' },
          'target-size': { score: 1 },
          'button-name': { score: null },
        },
      },
    },
    url,
  )
  assert.deepEqual(result, { findings: [], performance: 0, cls: 0 })
  assert.equal(parseMobileAudit({ lighthouseResult: comparable }, url), null)
  const clsOnly = parseMobileAudit(
    {
      lighthouseResult: {
        ...comparable,
        audits: {
          'cumulative-layout-shift': { numericValue: 0.33 },
          'target-size': { score: 0 },
        },
      },
    },
    url,
  )
  assert.ok(clsOnly)
  assert.match(clsOnly.findings[0].evidence, /0\.330/)
  assert.match(clsOnly.findings[1].evidence, /tap targets/)
})
test('mobile provider is optional and its failures leave the baseline report usable', async (t) => {
  const old = process.env.PAGESPEED_API_KEY
  t.after(() => {
    if (old === undefined) delete process.env.PAGESPEED_API_KEY
    else process.env.PAGESPEED_API_KEY = old
  })
  delete process.env.PAGESPEED_API_KEY
  let provider = 'success'
  let calls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (endpoint: URL, init: RequestInit) => {
      calls++
      assert.equal(endpoint.origin, 'https://www.googleapis.com')
      assert.equal(endpoint.searchParams.get('strategy'), 'mobile')
      assert.deepEqual(endpoint.searchParams.getAll('category'), [
        'performance',
        'seo',
        'accessibility',
      ])
      assert.equal(endpoint.searchParams.get('url'), url)
      assert.equal(
        new Headers(init.headers).get('X-Goog-Api-Key'),
        'example-key',
      )
      if (provider === 'offline') throw new Error('offline')
      if (provider === 'quota') return Response.json({}, { status: 429 })
      if (provider === 'malformed') return new Response('invalid')
      return Response.json({ lighthouseResult: report })
    },
  )
  assert.equal(await mobileAudit(url), null)
  assert.equal(calls, 0)
  process.env.PAGESPEED_API_KEY = 'example-key'
  assert.equal(await mobileAudit('https://localhost/'), null)
  assert.equal(calls, 0)
  assert.equal((await mobileAudit(url))?.lcpMs, 4461)
  for (provider of ['offline', 'quota', 'malformed'])
    assert.equal(await mobileAudit(url), null)
})
