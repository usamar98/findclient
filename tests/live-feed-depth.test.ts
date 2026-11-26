import assert from 'node:assert/strict'
import test from 'node:test'
import { researchMatchPlan, matchResearchPost } from '../lib/research-matching'
import { fetchForumResearchCandidates, fetchShopifyResearchCandidates } from '../lib/sources/forum-feeds'

const merchant = 'https://community.shopify.com'
const developer = 'https://community.shopify.dev'
const wp = 'https://wordpress.org/support/'
const time = Date.parse('2026-11-26T03:51:30Z')
const since = new Date(time - 900_000)
const instant = (age: number) => new Date(time - age * 1000).toUTCString()
const allow = () => new Response('User-agent: *\nAllow: /')
const rss = (...entries: string[]) => new Response('<rss><channel><title>Community</title>' + entries.join('') + '</channel></rss>')
const item = (url: string, title: string, body: string, age = 30) =>
  '<item><link>' + url + '</link><title>' + title + '</title><description><![CDATA[' + body +
  ']]></description><pubDate>' + instant(age) + '</pubDate></item>'

test('Shopify merchant and developer research capture original posts and replies published inside the window', async t => {
  t.mock.method(Date, 'now', () => time)
  const requests: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url)
    if (url.endsWith('/robots.txt')) return allow()
    if (url === developer + '/posts.rss') return rss(
      item(developer + '/t/apps/555#post_1', 'Checkout extension', 'How can I fix my checkout extension?'),
    )
    assert.equal(url, merchant + '/posts.rss')
    const root = merchant + '/t/store-theme/42'
    return rss(
      item(root + '#post_1', 'Our cart drawer stopped working', 'Could anyone help fix our cart drawer?', 45),
      item(root + '?page=3#post_22', 'Our cart drawer stopped working',
        '<aside class="quote"><blockquote>Could anyone help fix our cart drawer?</blockquote></aside><p>Thanks!</p>'),
      item(root + '#post_23', 'Our cart drawer stopped working', 'Can anyone help? My theme has the same issue.', 29),
      item(root + '#post_24', 'Stale', 'Could anyone help?', 901),
      item(root + '#post_25', 'Future', 'Fresh?', -1),
      item(root, 'Missing post number', 'No authoritative reply reference'),
      item('https://elsewhere.test/t/other/324#post_1', 'Off-site', 'Bad URL'),
    )
  })
  const result = await fetchShopifyResearchCandidates(since)
  assert.equal(requests.length, 4)
  assert.deepEqual(result.checked, ['Shopify merchants', 'Shopify developers'])
  assert.equal(result.partial, false)
  const byURL = new Map(result.posts.map(post => [post.url, post]))
  assert.equal(byURL.size, 4)
  const reply = byURL.get(merchant + '/t/store-theme/42/22')!
  assert.equal(reply.posted_at, '2026-11-26T03:51:00.000Z')
  assert.equal(reply.title, 'Thanks!')
  assert.equal(reply.body, 'Thanks!')
  const plan = researchMatchPlan('Shopify Developer')
  assert.equal(matchResearchPost(plan, reply), null)
  assert.equal(matchResearchPost(plan, byURL.get(merchant + '/t/store-theme/42')!)?.kind, 'help')
  assert.equal(matchResearchPost(plan, byURL.get(merchant + '/t/store-theme/42/23')!)?.kind, 'help')
  assert.equal(matchResearchPost(plan, byURL.get(developer + '/t/apps/555')!)?.kind, 'help')
})

test('WordPress verifies recent topic activity against precise reply and opening timestamps', async t => {
  t.mock.method(Date, 'now', () => time)
  const requests: string[] = []
  const old = wp + 'topic/old-question/'
  const fresh = wp + 'topic/new-question/'
  const skipped = wp + 'topic/lower-priority/'
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url)
    if (url.endsWith('/robots.txt')) return allow()
    if (url === wp + 'forums/feed/') return rss(
      item(old + '#post-11', 'Reply To: Need help with checkout', 'Thanks, that worked!'),
    )
    if (url === wp + 'view/all-topics/feed/') return rss(
      item(old, 'Need help with checkout', 'Days-old original question.', 30),
      item(fresh, 'Broken plugin', 'This is a recent topic', 60),
      item(skipped, 'Another topic', 'Beyond the per-search limit', 90),
    )
    if (url === old + 'feed/') return rss(
      item(old + '#post-11', 'Reply To: Need help with checkout', 'Thanks, that worked!'),
      item(old + '#post-10', 'Need help with checkout', 'Days-old original question.', 86400),
    )
    if (url === fresh + 'feed/') return rss(
      item(fresh + '#post-20', 'Broken plugin', '<p>Can anyone help with my plugin?</p>', 61),
    )
    if (url === 'https://forum.bubble.io/posts.rss' || url === 'https://community.webflow.com/rss/feed') return rss()
    throw new Error('Unexpected fetch ' + url)
  })
  const result = await fetchForumResearchCandidates(since)
  assert.deepEqual(result.unavailable, [])
  assert.equal(result.partial, true)
  assert.equal(requests.filter(url => url === 'https://wordpress.org/robots.txt').length, 1)
  assert.equal(requests.includes(skipped + 'feed/'), false)
  assert.deepEqual(result.posts.map(post => [post.url, post.title, post.posted_at]), [
    [old + '#post-11', 'Thanks, that worked!', new Date(time - 30_000).toISOString()],
    [fresh + '#post-20', 'Broken plugin', new Date(time - 61_000).toISOString()],
  ])
})

test('shopify feed cooldowns and publisher errors retain the other community', async t => {
  t.mock.method(Date, 'now', () => time)
  const requests: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url)
    if (url.endsWith('/robots.txt')) return allow()
    if (url === merchant + '/posts.rss') return new Response(null, { status: 429, headers: {'Retry-After': '120'} })
    assert.equal(url, developer + '/posts.rss')
    return rss(item(developer + '/t/theme/43#post_1', 'Theme question', 'How can I change my theme?'))
  })
  const live = await fetchShopifyResearchCandidates(since)
  assert.deepEqual(live.checked, ['Shopify developers'])
  assert.deepEqual(live.unavailable, ['Shopify merchants'])
  assert.deepEqual(live.backoffs.map(backoff => backoff.source), ['shopify'])
  assert.equal(live.posts.length, 1)
  assert.equal(live.partial, true)
  requests.length = 0
  const cached = await fetchShopifyResearchCandidates(since, new Map([['shopify', time + 10_000]]))
  assert.deepEqual(cached.checked, ['Shopify developers'])
  assert.deepEqual(cached.unavailable, ['Shopify merchants'])
  assert.equal(requests.some(url => url.startsWith(merchant + '/')), false)
})

test('longer windows supplement activity with newly created topics and mark truncated windows', async t => {
  t.mock.method(Date, 'now', () => time)
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/robots.txt')) return allow()
    if (url.startsWith(developer + '/')) return rss()
    if (url.endsWith('/posts.rss')) return rss(...Array.from({length: 50}, (_, i) =>
      item(merchant + '/t/very-active/42#post_' + (i + 2), 'Theme help wanted', 'Thanks for clarifying.', i + 10)))
    assert.equal(url, merchant + '/latest.rss?order=created')
    return rss(item(merchant + '/t/older-opening/855', 'My checkout stopped working', 'Is anyone able to help?', 3500))
  })
  const result = await fetchShopifyResearchCandidates(new Date(time - 3_600_000))
  assert.equal(result.unavailable.length, 0)
  assert.equal(result.posts.length, 51)
  assert.equal(result.partial, true)
  assert.equal(result.posts.at(-1)?.url, merchant + '/t/older-opening/855')
})
