import { z } from 'zod'
import {
  apiURL,
  cleanPosts,
  remote,
  ProviderBackoff,
  type Adapter,
} from './shared'
const str = z.string().nullish()
const hnHit = z.object({
  objectID: z.string().regex(/^\d+$/),
  title: str,
  story_title: str,
  author: str,
  story_text: str,
  comment_text: str,
  created_at: z.string(),
})
export const hn: Adapter = {
  async search(query, since) {
    const url = apiURL('https://hn.algolia.com/api/v1/search_by_date', {
      query,
      tags: '(ask_hn,comment)',
      numericFilters: 'created_at_i>=' + Math.floor(since.getTime() / 1000),
      hitsPerPage: '18',
    })
    const raw = z
      .object({ hits: z.array(z.unknown()) })
      .parse(await (await remote(url)).json())
    return cleanPosts(
      raw.hits.flatMap((x) => {
        const r = hnHit.safeParse(x)
        if (!r.success) return []
        const p = r.data
        return [
          {
            source: 'hn',
            title: p.title || p.story_title || 'Hacker News discussion',
            body: p.comment_text || p.story_text || '',
            url: 'https://news.ycombinator.com/item?id=' + p.objectID,
            author: p.author || '',
            posted_at: p.created_at,
          },
        ]
      }),
      since,
    )
  },
}
const bskyPost = z.object({
  uri: z.string(),
  author: z.object({ handle: z.string(), did: z.string() }),
  record: z.object({ text: z.string(), createdAt: z.string() }),
})
export const bluesky: Adapter = {
  async search(query, since) {
    // Bluesky's AppView serves public searches without an account. Use a stable
    // request window for shared caching, then enforce the caller's exact cutoff.
    const windowStart = new Date(Math.floor(since.getTime() / 300000) * 300000)
    const url = apiURL('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts', {
      q: query,
      since: windowStart.toISOString(),
      limit: '18',
      sort: 'latest',
    })
    const { posts } = z
      .object({ posts: z.array(z.unknown()) })
      .parse(await (await remote(url, { next: { revalidate: 300 } })).json())
    return cleanPosts(
      posts.flatMap((x) => {
        const parsed = bskyPost.safeParse(x)
        if (!parsed.success) return []
        const p = parsed.data
        const id =
          /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9.~-]+)$/.exec(
            p.uri,
          )
        if (!id || p.author.did !== id[1]) return []
        return [
          {
            source: 'bluesky',
            title: p.record.text.slice(0, 180),
            body: p.record.text,
            url:
              'https://bsky.app/profile/' +
              encodeURIComponent(p.author.did) +
              '/post/' +
              id[2],
            author: p.author.handle,
            posted_at: p.record.createdAt,
          },
        ]
      }),
      since,
    )
  },
}
const question = z.object({
  link: z.string().url(),
  title: z.string(),
  body: str,
  creation_date: z.number().int().positive(),
  owner: z.object({ display_name: str }).optional(),
})
export const stackexchange: Adapter = {
  async search(query, since) {
    const params: Record<string, string> = {
      q: query,
      site: 'stackoverflow',
      filter: 'withbody',
      sort: 'creation',
      order: 'desc',
      fromdate: String(Math.floor(since.getTime() / 300000) * 300),
      pagesize: '16',
      closed: 'false',
    }
    if (process.env.STACK_EXCHANGE_KEY)
      params.key = process.env.STACK_EXCHANGE_KEY
    const r = z
      .object({
        items: z.array(z.unknown()),
        backoff: z.number().optional(),
        quota_remaining: z.number().optional(),
      })
      .parse(
        await (
          await remote(
            apiURL('https://api.stackexchange.com/2.3/search/advanced', params),
            { next: { revalidate: 300 } },
          )
        ).json(),
      )
    if (r.backoff || r.quota_remaining === 0) {
      const reset = new Date()
      reset.setUTCHours(24, 0, 0, 0)
      throw new ProviderBackoff(
        new Date(
          Math.max(
            Date.now() + (r.backoff ?? 0) * 1000,
            r.quota_remaining === 0 ? reset.getTime() : 0,
          ),
        ),
      )
    }
    return cleanPosts(
      r.items.flatMap((x) => {
        const parsed = question.safeParse(x)
        if (!parsed.success) return []
        const p = parsed.data
        return [
          {
            source: 'stackexchange',
            title: p.title,
            body: p.body ?? '',
            author: p.owner?.display_name ?? '',
            url: p.link,
            posted_at: new Date(p.creation_date * 1000).toISOString(),
          },
        ]
      }),
      since,
    )
  },
}
