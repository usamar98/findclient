import { decode } from 'html-entities'
import { sources, type NicheInput } from '../niche'
export type SourceId = keyof typeof sources
export const sourceIds = Object.keys(sources) as SourceId[]
export type NormalizedPost = {
  source: SourceId
  title: string
  url: string
  author: string
  body: string
  posted_at: string
  /** Tags supplied by the source for this post, when available. */
  tags?: string[]
  /** An indexed publication date without a reliable time of day. */
  posted_precision?: 'day'
}
export interface Adapter {
  search(query: string, since: Date, watches?: Pick<NicheInput, 'hn_threads' | 'subreddits'>): Promise<NormalizedPost[]>
}
export function plain(value: string) {
  return decode(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}
export function postBody(value: string) {
  // A link labelled "our store" often carries the only usable site address.
  const withLinks = value.replace(
    /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_tag, _quote, href: string, label: string) => {
      const text = plain(label)
      try {
        const url = new URL(decode(href))
        if (
          !/^https?:$/.test(url.protocol) ||
          url.username ||
          url.password ||
          url.port ||
          !/\.[a-z]{2,}$/i.test(url.hostname) ||
          /\.(?:internal|local|localhost)$/i.test(url.hostname) ||
          url.href.length > 1000
        )
          return text
        return text.includes(url.href) ? text : text + ' (' + url.href + ')'
      } catch {
        return text
      }
    },
  )
  return plain(withLinks)
}
export function cleanPosts(posts: NormalizedPost[], since: Date) {
  const result = new Map<string, NormalizedPost>()
  for (const post of posts) {
    const time = Date.parse(post.posted_at)
    if (!Number.isFinite(time) || time < since.getTime() || time > Date.now())
      continue
    let url: URL
    try {
      url = new URL(post.url)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) continue
    if (!(post.source === 'forums' && url.hostname === 'wordpress.org' &&
      /^#post-\d+$/.test(url.hash))) url.hash = ''
    for (const k of Array.from(url.searchParams.keys()))
      if (/^utm_|^(fbclid|gclid|ref_src)$/i.test(k)) url.searchParams.delete(k)
    const title = plain(post.title).slice(0, 350)
    if (!title || url.href.length > 2000) continue
    result.set(url.href, {
      ...post,
      title,
      url: url.href,
      body: postBody(post.body).slice(0, 4500),
      author: plain(post.author).slice(0, 120),
      posted_at: new Date(time).toISOString(),
    })
  }
  return Array.from(result.values()).sort((a, b) =>
    b.posted_at.localeCompare(a.posted_at),
  )
}
export function apiURL(base: string, query: Record<string, string>) {
  const url = new URL(base)
  url.search = new URLSearchParams(query).toString()
  return url
}
export class ProviderBackoff extends Error {
  constructor(public retryAt: Date) {
    super('Provider requested a cooldown.')
  }
}
export function respectStackQuota(data: {
  backoff?: number
  quota_remaining?: number
}) {
  if (!data.backoff && data.quota_remaining !== 0) return
  const reset = new Date()
  reset.setUTCHours(24, 0, 0, 0)
  throw new ProviderBackoff(
    new Date(
      Math.max(
        Date.now() + (data.backoff ?? 0) * 1000,
        data.quota_remaining === 0 ? reset.getTime() : 0,
      ),
    ),
  )
}
export async function remote(url: string | URL, options: RequestInit = {}) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    ...options,
  })
  if (response.status === 429 || response.status === 503) {
    const retry = response.headers.get('retry-after') ?? ''
    const time = /^\d+$/.test(retry)
      ? Date.now() + Number(retry) * 1000
      : Date.parse(retry)
    throw new ProviderBackoff(
      new Date(
        Number.isFinite(time)
          ? Math.max(Date.now() + 1000, time)
          : Date.now() + 60000,
      ),
    )
  }
  if (!response.ok) throw new Error('Source returned HTTP ' + response.status)
  return response
}
