import assert from 'node:assert/strict'
import test from 'node:test'
import { matchResearchPost, researchMatchPlan } from '../lib/research-matching'
import { searchKeylessNetwork } from '../lib/sources/keyless-research'
import { ProviderBackoff } from '../lib/sources/shared'

const at = Date.parse('2026-07-01T12:15:22.000Z')
const since = new Date(at - 15 * 60_000)
const service = 'Shopify Developer'

test('short Hacker News research reads all item types and pages of the shared stream, then respects the exact cutoff', async t => {
  t.mock.method(Date, 'now', () => at)
  const pages: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.hostname === 'hacker-news.firebaseio.com') return Response.json(url.pathname.includes('maxitem') ? 1 : null)
    assert.equal(url.searchParams.get('query'), '')
    assert.equal(url.searchParams.has('tags'), false)
    assert.match(url.searchParams.get('numericFilters')!, /created_at_i>=/)
    const page = Number(url.searchParams.get('page'))
    pages.push(String(page))
    const recent = { objectID: '12', title: 'Can anyone fix my Shopify checkout?', created_at: since.toISOString() }
    const old = { ...recent, objectID: '13', created_at: new Date(+since - 500).toISOString() }
    return Response.json({ page, nbPages: 2, hits: page ? [recent, old] : [
      { ...recent, objectID: '11', comment_text: 'I enjoy cycling in the summer.' },
    ] })
  })
  const data = await searchKeylessNetwork('hn', service, since)
  assert.deepEqual(pages, ['0', '1'])
  assert.equal(data.partial, false)
  assert.equal(data.posts.length, 2)
  const relevant = data.posts.filter(post => matchResearchPost(researchMatchPlan(service), post))
  assert.deepEqual(relevant.map(p => p.url), ['https://news.ycombinator.com/item?id=12'])
})

test('Stack Overflow reads newly created questions without a query, preserves real tags and valid rows on a provider backoff', async t => {
  t.mock.method(Date, 'now', () => at)
  const issued: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    issued.push(url.pathname)
    assert.equal(url.searchParams.get('sort'), 'creation')
    assert.equal(url.searchParams.has('q'), false)
    assert.equal(init.next?.revalidate, 60)
    const post = { title: 'How can I fix the checkout theme?', body: 'My checkout button fails to update the cart. How can I fix it?',
      link: 'https://stackoverflow.com/questions/123/question', tags: ['shopify'], creation_date: at / 1000 - 30 }
    return Response.json({ has_more: true, backoff: 120, items: [
      post, { ...post, closed_date: post.creation_date, link: 'https://stackoverflow.com/questions/124/closed' },
    ] })
  })
  const data = await searchKeylessNetwork('stackexchange', service, since)
  assert.deepEqual(issued, ['/2.3/questions'])
  assert.equal(data.posts.length, 1)
  assert.deepEqual(data.posts[0].tags, ['shopify'])
  assert.equal(data.posts[0].body.includes('shopify'), false)
  assert.ok(matchResearchPost(researchMatchPlan(service), data.posts[0]))
  assert.equal(data.partial, true)
  assert.equal(data.retryAt?.getTime(), at + 120000)
})

test('Bluesky adds bounded buyer-language queries and stops on a throttled variant without dropping earlier results', async t => {
  t.mock.method(Date, 'now', () => at)
  const terms: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    terms.push(url.searchParams.get('q')!)
    assert.equal(url.searchParams.get('sort'), 'latest')
    if (terms.length === 3) return new Response(null, { status: 429, headers: { 'retry-after': '90' } })
    const post = { uri: 'at://did:plc:tester/app.bsky.feed.post/abc', author: { did: 'did:plc:tester', handle: 'test.invalid' },
      record: { text: 'Can anyone fix my Shopify checkout button?', createdAt: new Date(at - 30_000).toISOString() } }
    return Response.json({ posts: terms.length === 1 ? [] : [post] })
  })
  const data = await searchKeylessNetwork('bluesky', service, since)
  assert.ok(terms.some(term => term.toLowerCase() === 'shopify'))
  assert.equal(data.posts.length, 1)
  assert.equal(data.posts[0].posted_at, new Date(at - 30_000).toISOString())
  assert.equal(data.partial, true)
  assert.equal(data.retryAt?.getTime(), at + 90000)
})

test('total throttle stays visible; a busy term never produces unbounded pagination', async t => {
  t.mock.method(Date, 'now', () => at)
  let reads = 0
  const fetch = t.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.hostname === 'api.bsky.app') return new Response(null, { status: 429 })
    if (url.hostname === 'hacker-news.firebaseio.com') return Response.json(url.pathname.includes('maxitem') ? 1 : null)
    reads++
    return Response.json({ page: reads - 1, nbPages: 25, hits: [
      { objectID: '77', title: 'Shopify checkout question', created_at: new Date(at).toISOString() },
    ] })
  })
  await assert.rejects(searchKeylessNetwork('bluesky', 'Webflow', since), ProviderBackoff)
  assert.equal(fetch.mock.callCount(), 1)
  const data = await searchKeylessNetwork('hn', service, since)
  assert.equal(reads, 4)
  assert.equal(data.partial, true)
  assert.equal(data.posts.length, 1)
})

test('a busy newest stream uses its remaining request budget to find targeted jobs deeper in the selected window', async t => {
  t.mock.method(Date, 'now', () => at)
  const terms: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.hostname === 'hacker-news.firebaseio.com') return Response.json(url.pathname.includes('maxitem') ? 1 : null)
    const term = url.searchParams.get('query')!
    const page = Number(url.searchParams.get('page'))
    terms.push(term)
    const hit = { objectID: String(80 + page), title: 'Discussion of local bridges', created_at: new Date(at - 82_000).toISOString() }
    return Response.json(term ? { page, nbPages: 1, hits: term === 'software developer' ? [
      { ...hit, objectID: '123', title: 'We are hiring a software developer', created_at: since.toISOString() },
      { ...hit, objectID: '122', title: 'We are hiring a software developer', created_at: new Date(+since - 1_000).toISOString() },
    ] : [] } : { page, nbPages: 80, hits: [hit] })
  })
  const data = await searchKeylessNetwork('hn', 'software engineer', since)
  assert.deepEqual(terms, ['', '', 'software engineer', 'software developer'])
  assert.equal(data.partial, true)
  const plan = researchMatchPlan('software engineer')
  assert.deepEqual(data.posts.filter(post => matchResearchPost(plan, post)?.kind === 'hiring')
    .map(post => post.url), ['https://news.ycombinator.com/item?id=123'])
})
