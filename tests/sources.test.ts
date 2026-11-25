import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanPosts,
  ProviderBackoff,
  remote,
  type NormalizedPost,
} from '../lib/sources/shared'
import { indexed, shopify } from '../lib/sources/discovery'
import { bluesky, hn, stackexchange } from '../lib/sources/api'
import { FeedAccessRestricted, searchForumFeeds, shopifyRecent } from '../lib/sources/forum-feeds'
import { nicheSchema } from '../lib/niche'
const since = new Date('2025-08-01T00:00:00Z')
const post: NormalizedPost = {
  source: 'hn',
  url: 'https://news.ycombinator.com/item?id=7',
  title: 'A &amp; B',
  body: '<p>Help</p>',
  author: 'Pat',
  posted_at: '2025-08-02T00:00:00Z',
}
test('normalization rejects stale, undated and unsafe results and deduplicates tracking variants', () => {
  const list = cleanPosts(
    [
      post,
      { ...post, url: post.url + '&utm_source=xx#foo' },
      { ...post, posted_at: '' },
      { ...post, posted_at: '2024-07-12' },
      { ...post, url: 'javascript:void(0)' },
    ],
    since,
  )
  assert.equal(list.length, 1)
  assert.equal(list[0].url, post.url)
  assert.equal(list[0].title, 'A & B')
  assert.equal(list[0].body, 'Help')
})
test('provider HTTP throttling exposes the requested retry time', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(null, { status: 429, headers: { 'retry-after': '90' } }),
  )
  const started = Date.now()
  await assert.rejects(
    remote('https://example.com'),
    (e: unknown) =>
      e instanceof ProviderBackoff && e.retryAt.getTime() >= started + 90_000,
  )
})
test('Bluesky uses public AppView search and retains only recent posts from the claimed author', async (t) => {
  const cutoff = new Date('2025-08-01T00:03:05Z')
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(url.origin, 'https://api.bsky.app')
    assert.equal(url.searchParams.get('since'), '2025-08-01T00:03:00.000Z')
    assert.equal(init.next?.revalidate, 60)
    assert.equal(new Headers(init.headers).has('Authorization'), false)
    const author = { did: 'did:plc:example', handle: 'example.test' }
    const post = {
      uri: 'at://did:plc:example/app.bsky.feed.post/abc',
      author,
      record: { text: 'Can anyone help?', createdAt: '2025-08-01T00:04:00Z' },
    }
    return Response.json({
      posts: [
        post,
        { ...post, uri: 'at://did:plc:other/app.bsky.feed.post/abc' },
        {
          ...post,
          record: { ...post.record, createdAt: '2025-08-01T00:03:04Z' },
        },
      ],
    })
  })
  const posts = await bluesky.search('help', cutoff)
  assert.equal(posts.length, 1)
  assert.equal(posts[0].author, 'example.test')
})
test('Reddit adapter requests only indexed threads with a publication date', async (t) => {
  const original = process.env.EXA_API_KEY
  process.env.EXA_API_KEY = 'test'
  t.after(() => {
    if (original === undefined) delete process.env.EXA_API_KEY
    else process.env.EXA_API_KEY = original
  })
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, 'https://api.exa.ai/search')
    const result = {
      url: 'https://www.reddit.com/r/shopify/comments/abc/need_help/',
      title: 'Need help with a theme',
      publishedDate: '2025-08-02',
      highlights: ['Question'],
    }
    return Response.json({
      results: [
        result,
        {
          ...result,
          url: 'https://reddit.com.invalid/r/shopify/comments/abc/',
        },
        { ...result, publishedDate: null },
      ],
    })
  })
  const rows = await indexed('reddit').search('theme', since)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].source, 'reddit')
  assert.equal(rows[0].posted_precision, 'day')
})

test('watchlists normalize canonical thread URLs and subreddit names and reject external lookalikes', () => {
  const fields = nicheSchema.pick({ subreddits:true, hn_threads:true })
  assert.deepEqual(fields.parse({ hn_threads:['https://news.ycombinator.com/item?id=42','42'],
    subreddits:['r/Webflow','https://www.reddit.com/r/Webflow/'] }), { hn_threads:['42'], subreddits:['webflow'] })
  assert.deepEqual(fields.parse({}),{})
  for (const bad of ['https://news.ycombinator.com.example/item?id=42','https://news.ycombinator.com/user?id=42','https://news.ycombinator.com/item?id=42&id=7','-1']) {
    assert.equal(fields.safeParse({hn_threads:[bad]}).success,false)
  }
  assert.equal(fields.safeParse({subreddits:['webflow/comments']}).success,false)
})

test('watched hiring threads use Algolia story tags and return matching comment permalinks', async t => {
  const tagQueries: string[] = []
  t.mock.method(globalThis,'fetch',async (url: URL) => {
    tagQueries.push(url.searchParams.get('tags')!)
    const hit = { objectID:'402',story_id:42,story_title:'Freelancer thread',comment_text:'<p>Seeking Webflow migration help</p>',created_at:'2025-08-02T10:20:30Z' }
    return Response.json({hits:[hit,{...hit,objectID:'403',story_id:888},{...hit,objectID:'404',story_id:undefined}]})
  })
  const rows = await hn.search('Webflow',since,{hn_threads:['42','99']})
  assert.deepEqual(rows.map(row=>row.url),['https://news.ycombinator.com/item?id=402'])
  assert.equal(rows[0].title,'Seeking Webflow migration help')
  const general = await hn.search('Webflow',since,{subreddits:['webflow']})
  assert.equal(general[0].title,'Seeking Webflow migration help')
  assert.deepEqual(tagQueries,['comment,(story_42,story_99)','(ask_hn,comment)'])
})

test('one-minute indexed searches require precise publication dates even when the window crosses midnight', async t => {
  const saved = process.env.EXA_API_KEY
  process.env.EXA_API_KEY = 'test-only'
  t.after(() => { if (saved === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = saved })
  t.mock.method(Date, 'now', () => Date.parse('2026-11-26T00:00:20Z'))
  t.mock.method(globalThis, 'fetch', async () => {
    const result = { title: 'Need Webflow help', url: 'https://discourse.webflow.com/t/need-help/123' }
    return Response.json({ results: [
      { ...result, publishedDate: '2026-11-26' },
      { ...result, publishedDate: '2026-11-26T00:00:00.000Z' },
      { ...result, publishedDate: '2026-11-25T23:59:15Z' },
      { ...result, publishedDate: '2026-11-25T23:59:28Z', url: 'https://wordpress.org/support/topic/hiring/' },
      { ...result, publishedDate: '2026-11-25T23:59:28Z', url: 'https://wordpress.org/support/topic/hiring/#post-12345' },
      { ...result, publishedDate: '2026-11-26T00:00:10Z', url: 'https://discourse.webflow.com/t/' },
    ] })
  })
  const rows = await indexed('forums').search('Webflow', new Date('2026-11-25T23:59:20Z'))
  assert.deepEqual(rows.map(row => [row.url, row.posted_at]), [
    ['https://wordpress.org/support/topic/hiring/', '2026-11-25T23:59:28.000Z'],
  ])
})

test('Stack Overflow returns actual question creation dates and excludes stale or non-question links', async t => {
  const time = Date.parse('2026-11-25T12:03:12Z')
  const cutoff = new Date(time - 60000)
  t.mock.method(Date, 'now', () => time)
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(url.searchParams.get('sort'), 'creation')
    assert.equal(url.searchParams.get('order'), 'desc')
    assert.equal(init.next?.revalidate, 60)
    const question = { title: 'Need advice', creation_date: (time - 45000) / 1000, link: 'https://stackoverflow.com/questions/42/need-advice' }
    return Response.json({ items: [
      question,
      { ...question, link: 'https://stackoverflow.com/users/42' },
      { ...question, link: 'https://lookalike.test/questions/42/need-advice' },
      { ...question, link: 'https://stackoverflow.com/questions/41', creation_date: (time - 61000) / 1000 },
    ] })
  })
  const rows = await stackexchange.search('advice', cutoff)
  assert.deepEqual(rows.map(row => [row.url, row.posted_at]), [
    ['https://stackoverflow.com/questions/42/need-advice', '2026-11-25T12:02:27.000Z'],
  ])
})

test('Shopify reads newly created topics, honors crawl delay, and uses each open topic’s publication time', async t => {
  const time = Date.parse('2026-11-25T12:03:12Z')
  t.mock.method(Date, 'now', () => time)
  const item = (link: string, published: string, closed = 'No') =>
    '<item><title>Hiring developer</title><link>' + link + '</link><pubDate>' + published +
    '</pubDate><discourse:topicClosed>' + closed + '</discourse:topicClosed></item>'
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    if (url.endsWith('robots.txt')) return new Response('User-agent: *\nAllow: /\nCrawl-delay: 120')
    assert.equal(url, 'https://community.shopify.com/latest.rss?order=created')
    assert.equal(init.next?.revalidate, 120)
    const host = 'https://community.shopify.com/t/'
    const fresh = new Date(time - 30000).toUTCString()
    return new Response('<rss><channel>' + [
      item(host + 'hiring/42', fresh), item(host + 'older/40', new Date(time - 70000).toUTCString()),
      item(host + 'closed/43', fresh, 'Yes'), item(host + 'bad-link', fresh),
    ].join('') + '</channel></rss>')
  })
  const rows = await shopify.search('developer', new Date(time - 60000))
  assert.deepEqual(rows.map(row => [row.url, row.posted_at]), [
    ['https://community.shopify.com/t/hiring/42', '2026-11-25T12:02:42.000Z'],
  ])
})

test('Reddit watchlists send path filters and reject unrelated communities returned by the index', async t => {
  const saved = process.env.EXA_API_KEY
  process.env.EXA_API_KEY='test-only'
  t.after(()=>{if(saved===undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY=saved})
  t.mock.method(globalThis,'fetch',async (_url: string,init: RequestInit)=>{
    assert.deepEqual(JSON.parse(String(init.body)).includeDomains,['reddit.com/r/webflow/'])
    const result = {title:'Need help',publishedDate:'2025-08-02'}
    return Response.json({results:[
      {...result,url:'https://www.reddit.com/r/Webflow/comments/abc/help/'},
      {...result,url:'https://reddit.com/r/WebflowJobs/comments/abc/help/'},
      {...result,url:'https://example.com/r/webflow/comments/abc/help/'},
      {...result,url:'https://reddit.com/r/webflow/wiki/rules'},
    ]})
  })
  const rows=await indexed('reddit').search('help',since,{subreddits:['webflow']})
  assert.deepEqual(rows.map(r=>r.url),['https://www.reddit.com/r/Webflow/comments/abc/help/'])
})

test('public forum feeds report actual coverage and retain dated, matching posts through partial outages', async t => {
  const requests: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url)
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /')
    if (url.includes('wordpress.org')) return new Response('', {status: 429, headers: {'Retry-After': '120'}})
    const item = (path: string, age: string) => '<item><title>Hiring someone</title><link>https://community.webflow.com' +
      path + '</link><content:encoded><![CDATA[Need CSS help]]></content:encoded><pubDate>' + age + '</pubDate></item>'
    const published = 'Wed, 25 Nov 2026 12:00:20 GMT'
    return new Response('<rss><channel>' + [
      item('/jobs/post/apply-a1', published), item('/jobs', published),
      item('/jobs/post/repost', 'Wed, 25 Nov 2026 11:59:20 GMT'),
    ].join('') + '</channel></rss>')
  })
  t.mock.method(Date, 'now', () => Date.parse('2026-11-25T12:01:00Z'))
  const results = await searchForumFeeds('CSS', new Date('2026-11-25T12:00:00Z'), new Map([['forum:bubble', Date.now() + 10000]]))
  assert.deepEqual(results.checked, ['Webflow'])
  assert.deepEqual(results.unavailable, ['Bubble', 'WordPress'])
  assert.deepEqual(results.backoffs.map(x => x.source), ['forum:wordpress'])
  assert.deepEqual(results.posts.map(x => [x.url, x.posted_at]), [['https://community.webflow.com/jobs/post/apply-a1', '2026-11-25T12:00:20.000Z']])
  assert.equal(requests.some(url => url.includes('bubble.io')), false)
  assert.equal(requests.length, 4)
})

test('denied and malformed feeds are unavailable, while an empty successful feed is checked', async t => {
  const requests: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url)
    if (url.endsWith('/robots.txt')) return new Response(url.includes('wordpress.org') ? 'User-agent: LeadToClient\nDisallow: /support/' : 'User-agent: *\nAllow: /')
    return new Response(url.includes('webflow.com') ? '<html>Moved</html>' : '<rss><channel><title>Bubble topics</title></channel></rss>')
  })
  const result = await searchForumFeeds('Webflow', since)
  assert.deepEqual(result.checked, ['Bubble'])
  assert.deepEqual(result.unavailable, ['WordPress', 'Webflow'])
  assert.deepEqual(result.posts, [])
  assert.equal(requests.some(url => url.includes('wordpress.org/support/')), false)
})

test('live Shopify reports a restricted feed and scheduled Shopify skips it without fetching', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, 'https://community.shopify.com/robots.txt')
    return new Response('User-agent: *\nDisallow: /latest.rss')
  })
  await assert.rejects(shopifyRecent.search('Shopify', since), FeedAccessRestricted)
  assert.deepEqual(await shopify.search('Shopify', since), [])
})
