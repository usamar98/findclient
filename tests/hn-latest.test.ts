import test from 'node:test'
import assert from 'node:assert/strict'
import { searchKeylessNetwork } from '../lib/sources/keyless-research'
import { ProviderBackoff } from '../lib/sources/shared'

const now = Date.parse('2026-11-26T04:00:00Z')
const since = new Date(now - 60_000)
const fresh = now / 1000 - 15
const newest = { id: 24, type: 'comment', text: 'Can anyone fix my Shopify checkout?', time: fresh, by: 'owner' }
const indexed = { objectID: '24', comment_text: 'Older version', created_at: new Date(fresh * 1000).toISOString() }
const itemId = (url: URL) => Number(url.pathname.match(/item\/(\d+)\.json$/)?.[1])
const indexPage = (hits: unknown[]) => Response.json({ hits, page: 0, nbPages: 1 })

test('short searches sample eight consecutive HN items, respect original author and time, and prefer official copies', async t => {
  t.mock.method(Date, 'now', () => now)
  const ids: number[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    if (url.hostname === 'hn.algolia.com') return indexPage([indexed, { ...indexed, objectID: '22' }])
    assert.equal(url.hostname, 'hacker-news.firebaseio.com')
    assert.equal(options.next?.revalidate, 10)
    if (url.pathname.endsWith('/maxitem.json')) return Response.json(24)
    const id = itemId(url)
    ids.push(id)
    const rows: Record<number, unknown> = {
      24: newest, 23: { ...newest, id: 23, type: 'story', title: 'Ask HN: need a Shopify developer' },
      22: { id: 22, deleted: true }, 21: { ...newest, id: 21, dead: true },
      20: { ...newest, id: 20, time: now / 1000 + 5 }, 19: { ...newest, id: 19, type: 'poll' },
      18: { ...newest, id: 18, by: undefined }, 17: { ...newest, id: 17, time: now / 1000 - 61 },
    }
    return Response.json(rows[id])
  })
  const result = await searchKeylessNetwork('hn', 'Shopify developer', since)
  assert.deepEqual(ids.sort((a, b) => b - a), [24, 23, 22, 21, 20, 19, 18, 17])
  assert.deepEqual(result.posts.map(p => p.url).sort(), [23, 24].map(id => 'https://news.ycombinator.com/item?id=' + id))
  const post = result.posts.find(p => p.url.endsWith('=24'))!
  assert.deepEqual([post.body, post.author, post.posted_at], [newest.text, 'owner', new Date(fresh * 1000).toISOString()])
  assert.equal(result.partial, false)
})

test('retains official-only matches on Algolia cooldown and indexed matches on Firebase failure', async t => {
  t.mock.method(Date, 'now', () => now)
  let firebaseDown = false
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.hostname === 'hn.algolia.com') return firebaseDown ? indexPage([indexed]) :
      new Response(null, { status: 429, headers: { 'retry-after': '75' } })
    if (firebaseDown) return new Response(null, { status: 502 })
    if (url.pathname.includes('maxitem')) return Response.json(24)
    return Response.json(itemId(url) === 24 ? newest : null)
  })
  const first = await searchKeylessNetwork('hn', 'Shopify developer', since)
  assert.equal(first.posts[0].body, newest.text)
  assert.equal(first.partial, true)
  assert.equal(first.retryAt?.getTime(), now + 75000)
  firebaseDown = true
  const second = await searchKeylessNetwork('hn', 'Shopify developer', since)
  assert.equal(second.posts[0].body, indexed.comment_text)
  assert.equal(second.partial, true)
})

test('flags a gap between sources, honors individual-item cooldowns, and skips Firebase for long windows', async t => {
  t.mock.method(Date, 'now', () => now)
  let directCalls = 0, throttle = false
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.hostname === 'hn.algolia.com') return indexPage([])
    directCalls++
    if (url.pathname.includes('maxitem')) return Response.json(24)
    const id = itemId(url)
    if (throttle && id === 24) return new Response(null, { status: 503, headers: { 'retry-after': '45' } })
    return Response.json({ ...newest, id })
  })
  const gap = await searchKeylessNetwork('hn', 'Shopify developer', since)
  assert.equal(gap.posts.length, 8)
  assert.equal(gap.partial, true)
  throttle = true
  const interrupted = await searchKeylessNetwork('hn', 'Shopify developer', since)
  assert.equal(interrupted.posts.length, 7)
  assert.equal(interrupted.retryAt?.getTime(), now + 45000)
  directCalls = 0
  await searchKeylessNetwork('hn', 'Shopify developer', new Date(now - 3600000))
  assert.equal(directCalls, 0)
})

test('returns a provider cooldown if neither Hacker News route succeeds', async t => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }))
  await assert.rejects(searchKeylessNetwork('hn', 'Shopify developer', since), ProviderBackoff)
})
