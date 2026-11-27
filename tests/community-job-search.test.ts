import assert from 'node:assert/strict'
import test from 'node:test'
import { searchCommunityJobs } from '../lib/sources/community-job-search'
import { researchSnapshot } from '../lib/live-research'

const now = Date.parse('2026-11-28T12:00:00Z')
const when = (secondsAgo: number) => new Date(now - secondsAgo * 1_000).toISOString()
const since = new Date(when(300))
const merchant = 'https://community.shopify.com'

test('Jobs checks the merchant hiring board and attributes the original buyer rather than a reply that bumped an old topic', async t => {
  t.mock.method(Date, 'now', () => now)
  const reads: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    const url = input.toString()
    reads.push(url)
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /search\nDisallow: /c/*.rss')
    if (url.endsWith('/posts.rss')) return new Response('<rss><channel><title>Forum posts</title></channel></rss>')
    if (url.includes('/c/job-listings/334.json')) {
      const topic = { category_id: 334, visible: true, closed: false, archived: false, bumped_at: when(1) }
      return Response.json({ topic_list: { topics: [
        {...topic, id: 1, created_at: when(25)}, {...topic, id: 2, created_at: when(3)},
        {...topic, id: 3, created_at: when(302)}, {...topic, id: 4, created_at: when(1), closed: true},
      ] } })
    }
    const first = { post_number: 1, hidden: false, post_type: 1, username: 'merchant', created_at: when(25) }
    if (url === merchant + '/t/1/1.json') return Response.json({
      id: 1, category_id: 334, closed: false, archived: false, slug: 'store-hiring', title: 'Can anyone repair our Shopify checkout?',
      post_stream: {posts: [
        {...first, cooked: '<p>Our budget is $600 for the integration fix, and we are happy to pay your hourly rate.</p>'},
        {...first, post_number: 2, username: 'responder', cooked: '<p>I am a developer. Hire me!</p>'},
      ]},
    })
    assert.equal(url, merchant + '/t/2/1.json')
    return Response.json({id: 2, category_id: 334, closed: false, archived: false, slug: 'store-offers', title: 'Shopify development for merchants',
      post_stream: {posts: [{...first, cooked: '<p>Are you looking for a Shopify developer? Book a call with us.</p>'}]}})
  })
  const read = await searchCommunityJobs('shopify', 'Shopify developer', since)
  assert.equal(read.status, 'checked')
  assert.ok(read.checkedFeeds?.includes('Shopify Job Listings'))
  assert.equal(reads.filter(url => url === merchant + '/robots.txt').length, 1)
  assert.equal(reads.some(url => url.includes('/t/3/') || url.includes('/t/4/')), false)
  const result = researchSnapshot('Shopify developer', '5', [read], new Date(now))
  assert.equal(result.sources[0].reviewed, 2)
  assert.deepEqual(result.posts.map(p => [p.kind, p.author, p.posted_at, p.url, p.compensation]), [
    ['hiring', 'merchant', when(25), merchant + '/t/store-hiring/1', undefined],
  ])
})

test('typed HN and Bluesky searches keep real hiring requests while excluding sellers, advice, unpaid offers and old posts', async t => {
  t.mock.method(Date, 'now', () => now)
  const after = new Date(when(86400))
  const input = [
    ['Our team is hiring a freelance Shopify developer to build an app for our store.', when(25)],
    ['Can someone explain how my Shopify checkout works?', when(2)],
    ['If you are looking for a Shopify developer, my agency builds sites.', when(4)],
    ['We are hiring a Shopify developer for an unpaid role.', when(7)],
    ['We are hiring a Shopify developer for a freelance project.', when(86500)],
    ['We are hiring a mechanical engineer for a contract.', when(5)],
    ['I am a Shopify developer seeking clients. Hire me.', when(3)],
    ['Can anyone fix a Shopify checkout? I already pay Shopify every month. What am I missing?', when(1)],
  ]
  const terms = new Map<string, string[]>()
  t.mock.method(globalThis, 'fetch', async (value: string | URL) => {
    const url = new URL(value)
    const hn = url.hostname === 'hn.algolia.com'
    terms.set(url.hostname, [...terms.get(url.hostname) ?? [], url.searchParams.get(hn ? 'query' : 'q')!])
    if (hn) return Response.json({ page: 0, nbPages: 1, hits: input.map(([title, created_at], i) =>
      ({ title, objectID: String(100 + i), author: 'poster', created_at })) })
    assert.equal(url.hostname, 'api.bsky.app')
    return Response.json({ posts: input.map(([text, createdAt], i) => ({
      uri: 'at://did:plc:studio/app.bsky.feed.post/post' + i,
      author: {handle: 'studio.bsky.social', did: 'did:plc:studio'}, record: {text, createdAt},
    })) })
  })
  for (const source of ['bluesky', 'hn'] as const) {
    const read = await searchCommunityJobs(source, 'Shopify developer', after)
    const result = researchSnapshot('Shopify developer', '1440', [read], new Date(now))
    assert.equal(read.status, 'checked')
    assert.equal(result.posts.length, 1)
    assert.equal(result.posts[0].title, input[0][0])
    assert.equal(result.posts[0].posted_at, when(25))
    assert.ok(result.posts[0].author)
  }
  assert.ok([...terms.values()].every(group => group.includes('Shopify developer') && group.includes('shopify hiring') && group.length <= 4))
})

test('respect network cooldowns, throttling and the merchant category publisher rules', async t => {
  t.mock.method(Date, 'now', () => now)
  const reads: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    const url = input.toString()
    reads.push(url)
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /c/')
    if (url.endsWith('/posts.rss')) return new Response('<rss><channel><title>Forum posts</title></channel></rss>')
    assert.match(url, /^https:\/\/api\.bsky\.app\//)
    return new Response(null, {status: 429, headers: {'retry-after': '120'}})
  })
  const cooled = await searchCommunityJobs('hn', 'Shopify developer', since, new Map([['hn', now + 60_000]]))
  assert.equal(cooled.status, 'cooldown')
  assert.equal(reads.length, 0)
  const denied = await searchCommunityJobs('bluesky', 'Shopify developer', since)
  assert.equal(denied.status, 'cooldown')
  assert.deepEqual(denied.backoffs, [{source: 'bluesky', retryAt: new Date(now + 120_000)}])
  const shopify = await searchCommunityJobs('shopify', 'Shopify developer', since)
  assert.equal(shopify.status, 'checked')
  assert.equal(shopify.partial, true)
  assert.deepEqual(shopify.unavailableFeeds, ['Shopify Job Listings'])
  assert.ok(!reads.some(url => url.includes('/c/')))
})
