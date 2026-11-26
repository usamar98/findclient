import assert from 'node:assert/strict'
import test from 'node:test'
import { searchPublicProjects } from '../lib/sources/public-projects'
import { ProviderBackoff } from '../lib/sources/shared'

const now = Date.parse('2026-11-26T04:10:00Z')
const since = new Date(now - 900_000)
function issue(number: number, overrides: Record<string, unknown> = {}) {
  return {
    number, html_url: 'https://github.com/example/shop/issues/' + number, title: 'Fix the Shopify cart drawer',
    created_at: '2026-11-26T04:09:45Z', updated_at: '2026-11-26T04:09:59Z', body: '**Bounty: $250 USD** for a fix with a passing regression test.',
    labels: [{ name: 'bounty' }], author_association: 'MEMBER', state: 'open', closed_at: null, locked: false,
    assignees: [], assignee: null, ...overrides,
  }
}
const page = (items: unknown[], other = {}) => Response.json({ total_count: items.length, incomplete_results: false, items, ...other })

test('public GitHub bounties require an original, open, unassigned task and a maintainer offering real payment', async t => {
  t.mock.method(Date, 'now', () => now)
  const rows = [
    issue(1), issue(1), issue(2, { title: '[Bounty: EUR 80] Port the Shopify template', body: '' }),
    issue(3, { body: 'Expected revenue: $500. Please post a bounty.' }),
    issue(4, { author_association: 'NONE' }), issue(5, { assignees: [{ login: 'claimed' }] }),
    issue(6, { created_at: '2026-11-26T03:54:59Z' }), issue(7, { created_at: '2026-11-26' }),
    issue(8, { html_url: 'https://github.com@bad.example/shop/issues/8' }),
    issue(9, { body: '> Bounty: $50 for the fix' }), issue(10, { body: 'Bounty: $0 USD' }),
    issue(11, { title: 'Bug bounty program' }), issue(12, { pull_request: {} }),
    issue(13, { body: 'Bounty: 500 leaderboard points.' }), issue(14, { state: 'closed' }),
    issue(15, { body: 'Bounty: $25 - no bounty is available for this project.' }), issue(16, { locked: true }),
    issue(17, { body: 'We will pay £150 for documentation improvements.' }),
    issue(18, { labels: [{ name: 'bounty claimed' }] }),
    issue(19, { body: 'See [Bounty: $500](https://example.org/issues/123).' }),
    issue(20, { body: 'Bounty: $25', created_at: '2026-11-26T04:10:05Z' }),
    issue(21, { title: 'Create a referral bonus landing page', body: 'Reward: $500 for referrals to this giveaway' }),
    issue(22, { title: 'Unspecified cash amount', body: 'Bounty: $60 today' }),
  ]
  const urls = new Set<string>()
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    urls.add(url.toString())
    assert.equal(url.hostname, 'api.github.com')
    assert.equal(url.searchParams.get('sort'), 'created')
    assert.equal(options.next?.revalidate, 60)
    assert.equal(new Headers(options.headers).has('authorization'), false)
    return page(rows, { total_count: 300 })
  })
  const result = await searchPublicProjects('github', since)
  assert.equal(result.partial, false)
  assert.deepEqual(result.posts.map(row => [row.url.split('/').pop(), row.compensation]), [['1', '$250 USD'], ['2', 'EUR 80'], ['17', '£150']])
  assert.equal(result.posts[0].posted_at, '2026-11-26T04:09:45.000Z')
  assert.equal(result.posts[0].author, 'example/shop')
  assert.equal(result.posts[0].engagement, 'paid_freelance')
  assert.ok(result.candidates.some(candidate => candidate.url.endsWith('/3')))
  assert.deepEqual(result.candidates[0], { url: rows[0].html_url, posted_at: '2026-11-26T04:09:45.000Z' })
  assert.equal(result.candidates.some(candidate => candidate.url.includes('bad.example') || candidate.url.endsWith('/12')), false)
  await searchPublicProjects('github', new Date(now - 60_000))
  assert.equal((await searchPublicProjects('github', since)).posts.length, 3)
  assert.equal(urls.size, 1)
})

test('GitHub coverage flags truncation and respects primary and secondary cooldowns', async t => {
  t.mock.method(Date, 'now', () => now)
  const reset = String((now + 300_000) / 1000)
  let response = page([issue(1)], { total_count: 500 })
  t.mock.method(globalThis, 'fetch', async () => response)
  assert.equal((await searchPublicProjects('github', since)).partial, true)
  response = page([], { incomplete_results: true })
  assert.equal((await searchPublicProjects('github', since)).partial, true)
  response = Response.json({ items: [issue(1)], incomplete_results: false, total_count: 1 }, { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset } })
  const exhausted = await searchPublicProjects('github', since)
  assert.equal(exhausted.posts.length, 1)
  assert.equal(exhausted.retryAt?.getTime(), now + 300_000)
  response = new Response(null, { status: 403, headers: { 'retry-after': '75' } })
  await assert.rejects(searchPublicProjects('github', since), (e: unknown) => e instanceof ProviderBackoff && +e.retryAt === now + 75_000)
  response = Response.json({ message: 'You have exceeded a secondary rate limit.' }, { status: 403 })
  await assert.rejects(searchPublicProjects('github', since), ProviderBackoff)
  response = new Response('Forbidden', { status: 403 })
  await assert.rejects(searchPublicProjects('github', since), /Source returned HTTP 403/)
  response = Response.json({})
  await assert.rejects(searchPublicProjects('github', since))
  response = new Response(' '.repeat(2_500_001))
  await assert.rejects(searchPublicProjects('github', since), /size limit/i)
})
