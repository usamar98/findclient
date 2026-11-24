import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanPosts,
  ProviderBackoff,
  remote,
  type NormalizedPost,
} from '../lib/sources/shared'
import { indexed } from '../lib/sources/discovery'
import { bluesky, hn } from '../lib/sources/api'
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
    assert.equal(url.searchParams.get('since'), '2025-08-01T00:00:00.000Z')
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
    const hit = { objectID:'402',story_id:42,story_title:'Freelancer thread',comment_text:'<p>Seeking Webflow migration help</p>',created_at:'2025-08-02' }
    return Response.json({hits:[hit,{...hit,objectID:'403',story_id:888},{...hit,objectID:'404',story_id:undefined}]})
  })
  const rows = await hn.search('Webflow',since,{hn_threads:['42','99']})
  assert.deepEqual(rows.map(row=>row.url),['https://news.ycombinator.com/item?id=402'])
  assert.equal(rows[0].title,'Seeking Webflow migration help')
  await hn.search('Webflow',since,{subreddits:['webflow']})
  assert.deepEqual(tagQueries,['comment,(story_42,story_99)','(ask_hn,comment)'])
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
