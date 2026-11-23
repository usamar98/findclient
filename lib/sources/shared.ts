import { decode } from 'html-entities'
import { sources } from '../niche'
export type SourceId = keyof typeof sources
export const sourceIds = Object.keys(sources) as SourceId[]
export type NormalizedPost = {
  source: SourceId
  title: string
  url: string
  author: string
  body: string
  posted_at: string
}
export interface Adapter {
  search(query: string, since: Date): Promise<NormalizedPost[]>
}
export function plain(value: string) {
  return decode(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
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
    if (url.protocol !== 'https:' || url.username || url.password) continue
    url.hash = ''
    for (const k of Array.from(url.searchParams.keys()))
      if (/^utm_|^(fbclid|gclid|ref_src)$/i.test(k)) url.searchParams.delete(k)
    const title = plain(post.title).slice(0, 350)
    if (!title || url.href.length > 2000) continue
    result.set(url.href, {
      ...post,
      title,
      url: url.href,
      body: plain(post.body).slice(0, 4500),
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
