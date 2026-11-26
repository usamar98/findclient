import { z } from 'zod'
import {
  apiURL,
  cleanPosts,
  plain,
  remote,
  respectStackQuota,
  type Adapter,
} from './shared'
const str = z.string().nullish()
const hnHit = z.object({
  objectID: z.string().regex(/^\d+$/),
  title: str,
  author: str,
  story_text: str,
  comment_text: str,
  story_id: z.union([z.number().int().positive(), z.string()]).nullish(),
  created_at: z.iso.datetime({ offset: true }),
})
export function readHnPosts(rows: unknown[], since: Date, threads: readonly string[] = []) {
  return cleanPosts(
    rows.flatMap((x) => {
      const r = hnHit.safeParse(x)
      if (!r.success) return []
      const p = r.data
      if (threads.length && (!p.comment_text || !threads.includes(String(p.story_id)))) return []
      const title = p.comment_text ? plain(p.comment_text).slice(0, 180) : p.title
      if (!title) return []
      return [
        {
          source: 'hn',
          title,
          body: p.comment_text || p.story_text || '',
          url: 'https://news.ycombinator.com/item?id=' + p.objectID,
          author: p.author || '',
          posted_at: p.created_at,
        },
      ]
    }),
    since,
  )
}

export const hn: Adapter = {
  async search(query, since, watches) {
    const threads = watches?.hn_threads ?? []
    const tags = threads.map(id => 'story_' + id)
    const comments = tags.length === 1 ? tags[0] : '(' + tags.join(',') + ')'
    const url = apiURL('https://hn.algolia.com/api/v1/search_by_date', {
      query,
      tags: threads.length ? 'comment,' + comments : '(ask_hn,comment)',
      numericFilters: 'created_at_i>=' + Math.floor(since.getTime() / 60000) * 60,
      hitsPerPage: '18',
    })
    const raw = z
      .object({ hits: z.array(z.unknown()) })
      .parse(await (await remote(url, { next: { revalidate: 60 } })).json())
    return readHnPosts(raw.hits, since, threads)
  },
}
const bskyPost = z.object({
  uri: z.string(),
  author: z.object({ handle: z.string(), did: z.string().regex(/^did:(plc|web):[a-zA-Z0-9.:%-]+$/) }),
  record: z.object({ text: z.string(), createdAt: z.iso.datetime({ offset: true }) }),
})
export function readBlueskyPosts(rows: unknown[], since: Date) {
  return cleanPosts(
    rows.flatMap((x) => {
      const parsed = bskyPost.safeParse(x)
      if (!parsed.success) return []
      const p = parsed.data
      const id =
        /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9.~-]+)$/.exec(
          p.uri,
        )
      if (!id || p.author.did !== id[1] || id[2] === '.' || id[2] === '..') return []
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
}

export const bluesky: Adapter = {
  async search(query, since) {
    // Bluesky's AppView serves public searches without an account. Use a stable
    // request window for shared caching, then enforce the caller's exact cutoff.
    const windowStart = new Date(Math.floor(since.getTime() / 60000) * 60000)
    const url = apiURL('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts', {
      q: query,
      since: windowStart.toISOString(),
      limit: '18',
      sort: 'latest',
    })
    const { posts } = z
      .object({ posts: z.array(z.unknown()) })
      .parse(await (await remote(url, { next: { revalidate: 60 } })).json())
    return readBlueskyPosts(posts, since)
  },
}
const question = z.object({
  link: z.string().url(),
  title: z.string(),
  body: str,
  creation_date: z.number().int().positive(),
  closed_date: z.number().optional(),
  tags: z.array(z.string()).optional(),
  owner: z.object({ display_name: str }).optional(),
})
export function readStackQuestions(rows: unknown[], since: Date) {
  return cleanPosts(
    rows.flatMap((x) => {
      const parsed = question.safeParse(x)
      if (!parsed.success) return []
      const p = parsed.data
      if (p.closed_date) return []
      const permalink = new URL(p.link)
      if (permalink.hostname !== 'stackoverflow.com' || !/^\/questions\/\d+(?:\/[^/]+)?\/?$/.test(permalink.pathname)) return []
      const created = new Date(p.creation_date * 1000)
      if (!Number.isFinite(created.getTime())) return []
      return [
        {
          source: 'stackexchange',
          tags: p.tags,
          title: p.title,
          body: p.body ?? '',
          author: p.owner?.display_name ?? '',
          url: p.link,
          posted_at: created.toISOString(),
        },
      ]
    }),
    since,
  )
}

export const stackexchange: Adapter = {
  async search(query, since) {
    const params: Record<string, string> = {
      q: query,
      site: 'stackoverflow',
      filter: 'withbody',
      sort: 'creation',
      order: 'desc',
      fromdate: String(Math.floor(since.getTime() / 60000) * 60),
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
            { next: { revalidate: 60 } },
          )
        ).json(),
      )
    respectStackQuota(r)
    return readStackQuestions(r.items, since)
  },
}
