import assert from 'node:assert/strict'
import test from 'node:test'
import { researchInput, researchSnapshot } from '../lib/live-research'
import { redditRecent, xRecent } from '../lib/sources/research-social'
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
