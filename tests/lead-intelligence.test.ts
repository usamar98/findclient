import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessBuyer, closedRequest } from '../lib/lead-intelligence'
import { alertDestination } from '../lib/alert-webhook'
import { checkBuyerSource } from '../lib/sources/verification'
import { postBody } from '../lib/sources/shared'

const post = {
  title: 'Looking to hire a designer',
  body: 'Our store needs a redesign. Budget is $4,000. Please send a quote by Friday.',
  posted_at: '2026-11-01T09:00:00Z',
  url: 'https://news.ycombinator.com/item?id=12',
}
test('buyer score is grounded in exact source text and unknown metadata stays unknown', () => {
  const intel = assessBuyer(
    post,
    {
      request_type: 'hiring',
      evidence: {
        request: 'Looking to hire a designer',
        budget: 'We have $80,000',
        urgency: 'Tomorrow at noon',
        business: 'We are a funded startup',
      },
    },
    '2025-01-01T00:00:00Z',
  )
  assert.equal(intel.quality_score, 100)
  assert.equal(intel.evidence.business, 'Our store needs a redesign.')
  assert.equal(intel.evidence.budget, 'Budget is $4,000.')
  assert.equal(intel.availability.state, 'unknown')
  const missing = assessBuyer(
    { ...post, title: 'Question', body: 'Thoughts?' },
    undefined,
    '2030-01-01T00:00:00Z',
  )
  assert.equal(missing.quality_score, null)
  assert.equal(missing.account_created_at, null)
  assert.equal(missing.request_type, 'unclear')
  const unpaid = assessBuyer({
    ...post,
    body: 'Looking to hire someone. Our budget is zero.',
  })
  assert.equal(unpaid.quality_score, 30)
})
test('closures and unavailable source accounts never become verified open jobs', async (t) => {
  assert.ok(closedRequest('Thanks everyone, the role is filled.'))
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return Response.json({
      id: 12,
      by: 'different',
      title: 'Quick project update',
      text: 'Applications are closed.',
    })
  })
  const info = await checkBuyerSource(
    { source: 'hn', url: post.url, author: 'a' },
    true,
  )
  assert.equal(info.availability.state, 'closed')
  assert.equal(info.accountCreated, null)
  assert.equal(calls, 1)
  assert.equal(
    (await checkBuyerSource({ source: 'reddit', url: post.url, author: 'a' }))
      .availability.state,
    'unknown',
  )
  assert.equal(calls, 1)
})
test('verified Stack Overflow profiles supply account age and provider backoff is respected', async (t) => {
  const urls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    urls.push(url.pathname)
    return Response.json(
      url.pathname.includes('/questions/')
        ? {
            items: [
              {
                question_id: 3,
                title: 'Help',
                owner: { user_id: 7, display_name: 'Ada' },
              },
            ],
          }
        : { items: [{ user_id: 7, creation_date: 1700000000, website_url: 'https://example.org/' }] },
    )
  })
  const target = {
    source: 'stackexchange',
    url: 'https://stackoverflow.com/questions/3/help',
    author: 'Ada',
  }
  const result = await checkBuyerSource(target, true)
  assert.equal(result.accountCreated, new Date(1700000000 * 1000).toISOString())
  assert.equal(result.profileSite, 'https://example.org/')
  assert.deepEqual(urls, ['/2.3/questions/3', '/2.3/users/7'])
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ items: [], backoff: 60 }),
  )
  await assert.rejects(checkBuyerSource(target, true), /cooldown/)
})
test('site context survives HTML normalization and alert endpoints are limited to supported providers', () => {
  assert.equal(
    postBody('Visit <a href="https://mystore.com">our store</a>.'),
    'Visit our store (https://mystore.com/).',
  )
  assert.equal(postBody('<a href="http://127.0.0.1">store</a>'), 'store')
  assert.ok(
    alertDestination('https://hooks.slack.com/services/T11/B22/test')?.slack,
  )
  assert.ok(alertDestination('https://studio.app.n8n.cloud/webhook/qualified'))
  for (const unsafe of [
    'http://hooks.slack.com/services/T11/B22/test',
    'https://hooks.slack.com.attacker.org/services/T/B/c',
    'https://127.0.0.1/test',
    'https://user:pw@hook.eu1.make.com/auth',
    'https://hooks.zapier.com/open-redirect',
  ])
    assert.equal(alertDestination(unsafe), null)
})
