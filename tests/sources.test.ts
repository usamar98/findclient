import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanPosts,
  ProviderBackoff,
  remote,
  type NormalizedPost,
} from '../lib/sources/shared'
import { indexed } from '../lib/sources/discovery'
import { bluesky } from '../lib/sources/api'
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
