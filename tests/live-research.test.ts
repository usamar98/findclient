import assert from 'node:assert/strict'
import test from 'node:test'
import { researchInput, researchSnapshot } from '../lib/live-research'
import { redditRecent, xRecent } from '../lib/sources/research-social'
import { keylessSources, paidSources, type PaidProjectPost } from '../lib/research-catalog'
import type { NormalizedPost } from '../lib/sources/shared'

test('research validates every platform and preserves a one-minute time window', () => {
  const form = new FormData()
  form.set('q', ' web design ')
  form.set('window', '1')
  assert.equal(researchInput(form), null)
  for (const source of ['reddit', 'hn', 'reddit']) form.append('source', source)
  assert.deepEqual(researchInput(form), { q: 'web design', minutes: '1', sources: ['hn', 'reddit'] })
  form.append('source', 'any-url')
  assert.equal(researchInput(form), null)
})

test('research keeps precise publication times inside the window at response time, and reports unavailable platforms', () => {
  const at = new Date('2026-01-02T00:00:30Z')
  function post(id: number, date: string): NormalizedPost {
    return { source: 'hn', title: 'Looking for a software engineer', url: 'https://news.ycombinator.com/item?id=' + id, body: '', author: 'tester', posted_at: date }
  }
  const posts = [
    post(1, '2026-01-01T23:59:30Z'), post(2, '2026-01-02T00:00:20Z'), post(1, '2026-01-01T23:59:30Z'),
    post(3, '2026-01-01T23:59:29Z'), post(4, '2026-01-02T00:00:31Z'), post(5, ''),
    { ...post(6, '2026-01-02T00:00:00Z'), posted_precision: 'day' as const },
  ]
  const result = researchSnapshot('engineer', '1', [
    { source: 'hn', indexed: false, status: 'checked', posts },
    { source: 'forums', indexed: true, status: 'unavailable', posts: [] },
  ], at)
  assert.deepEqual(result.posts.map(p => p.url), [posts[1].url, posts[0].url])
  assert.equal(result.sources[0].count, 2)
  assert.equal(result.sources[1].status, 'unavailable')
})

test('browsing all openings accepts an empty query only for verified paid sources', () => {
  const form = new FormData()
  form.set('window', '1')
  form.set('q', ' ')
  for (const source of paidSources) form.append('source', source)
  assert.ok(paidSources.every(source => keylessSources.includes(source)))
  assert.deepEqual(researchInput(form), { q: '', minutes: '1', sources: paidSources })
  form.set('q', 'x')
  assert.equal(researchInput(form), null)
  form.set('q', '')
  form.append('source', 'bluesky')
  assert.equal(researchInput(form), null)
})

test('paid listings preserve price, service relevance, per-source runtime and exact publication window', () => {
  const now = new Date('2026-11-26T06:00:00Z')
  const post: PaidProjectPost = { source: 'weworkremotely', title: 'Contract WordPress developer', body: 'Build a storefront.',
    author: 'Client', url: 'https://weworkremotely.com/remote-jobs/a', engagement: 'paid_freelance',
    compensation: '$50/hour', posted_at: '2026-11-26T05:59:00Z' }
  const unrelated = { ...post, title: 'Freelance illustrator', url: post.url + 'b', posted_at: '2026-11-26T05:59:50Z' }
  const expired = { ...post, url: post.url + 'c', posted_at: '2026-11-26T05:58:59Z' }
  const salaryUndisclosed = { url: post.url + 'd', posted_at: '2026-11-26T05:59:15Z' }
  const source = [{ source: post.source, status: 'checked' as const, indexed: false, durationMs: 82,
    posts: [post, unrelated, expired], candidates: [post, expired, salaryUndisclosed, salaryUndisclosed] }]
  const result = researchSnapshot('WordPress developer', '1', source, now)
  assert.deepEqual(result.posts.map(p => [p.url, p.kind, p.engagement, p.compensation]), [[post.url, 'hiring', 'paid_freelance', '$50/hour']])
  assert.equal(result.sources[0].durationMs, 82)
  assert.equal(result.sources[0].reviewed, 3)
  assert.deepEqual(researchSnapshot('', '1', source, now).posts.map(p => p.url), [unrelated.url, post.url])
  assert.equal(researchSnapshot('WordPress developer London', '1', source, now).posts.length, 0)
})

test('a short Shopify search counts the fresh posts it reviewed and distinguishes hiring, help and general discussion', () => {
  const checkedAt = new Date('2026-11-26T03:51:30Z')
  function candidate(id: number, title: string, postedAt: string): NormalizedPost {
    return { source: 'shopify', title, body: '', author: 'merchant', url: `https://community.shopify.com/t/store/${id}`, posted_at: postedAt }
  }
  const hiring = candidate(1, 'Looking for a Shopify developer to redesign our storefront', '2026-11-26T03:51:00Z')
  const help = candidate(2, 'How can I fix our checkout after changing the theme?', '2026-11-26T03:36:30Z')
  const discussion = candidate(3, 'My notes from the Shopify developer conference', '2026-11-26T03:45:20Z')
  const unrelated = candidate(4, 'Weekend reading list', '2026-11-26T03:47:20Z')
  const posts = [help, hiring, hiring, discussion, unrelated,
    { ...help, url: help.url + '/2', posted_at: '2026-11-26T03:36:29Z' },
    { ...hiring, url: hiring.url + '/2', posted_precision: 'day' as const }]
  const inputs = [{ source: 'shopify' as const, indexed: false, status: 'checked' as const, partial: true, posts }]
  const result = researchSnapshot('Shopify Developer', '15', inputs, checkedAt)
  assert.deepEqual(result.posts.map(post => [post.kind, post.url]), [['hiring', hiring.url], ['topic', discussion.url], ['help', help.url]])
  assert.deepEqual(result.sources.map(source => [source.reviewed, source.count, source.requests, source.partial]), [[4, 3, 2, true]])
  assert.equal(result.posts[2].excerpt, help.title)
  assert.deepEqual(researchSnapshot('Shopify Developer', '1', inputs, checkedAt).posts.map(post => post.posted_at), [hiring.posted_at])
})

test('official social searches retain author and source ID with the original publication timestamp', async t => {
  const since = new Date('2025-08-01T12:00:00Z')
  const published = '2025-08-01T12:00:32Z'
  const actualFetches: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL, options: RequestInit) => {
    const url = new URL(input)
    actualFetches.push(url.hostname)
    assert.equal(options.cache, 'no-store')
    if (url.hostname === 'api.x.com') {
      assert.equal(url.searchParams.get('sort_order'), 'recency')
      assert.equal(url.searchParams.get('query'), 'engineer')
      return Response.json({ meta: { result_count: 1 }, data: [{ id: '1234', author_id: '42', text: 'Hiring an engineer', created_at: published }],
        includes: { users: [{ id: '42', username: 'tester' }] } })
    }
    if (url.hostname === 'www.reddit.com') return Response.json({ access_token: 'test-token', expires_in: 3600 })
    assert.equal(url.searchParams.get('sort'), 'new')
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer test-token')
    return Response.json({ data: { children: [{ kind: 't3', data: { id: 'abc123', subreddit: 'webdev', author: 'tester', title: 'Hiring an engineer',
      created_utc: Date.parse(published) / 1000 } }] } })
  })
  const [x, reddit] = await Promise.all([xRecent.search('engineer', since), redditRecent.search('engineer', since)])
  assert.equal(x[0].url, 'https://x.com/tester/status/1234')
  assert.equal(reddit[0].url, 'https://www.reddit.com/r/webdev/comments/abc123/')
  assert.equal(reddit[0].posted_at, x[0].posted_at)
  assert.equal(Date.parse(x[0].posted_at), Date.parse(published))
  assert.equal(x[0].author, 'tester')
  assert.deepEqual(actualFetches.sort(), ['api.x.com', 'oauth.reddit.com', 'www.reddit.com'])
})
