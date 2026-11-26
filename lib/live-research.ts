import { sources } from './niche'
import { matchResearchPost, researchMatchPlan } from './research-matching'
import type { NormalizedPost, SourceId } from './sources/shared'

export const researchSources = Object.keys(sources) as SourceId[]
export const keylessSources: SourceId[] = ['hn', 'bluesky', 'stackexchange', 'shopify', 'forums']
export const researchWindows = { '1': 'Past minute', '15': 'Past 15 minutes', '60': 'Past hour', '1440': 'Past 24 hours' } as const
export type ResearchWindow = keyof typeof researchWindows

export function researchInput(form: FormData) {
  const q = form.get('q')
  const window = form.get('window')
  const selected = form.getAll('source')
  if (typeof q !== 'string' || q.trim().length < 2 || q.trim().length > 100 ||
    typeof window !== 'string' || !Object.hasOwn(researchWindows, window) ||
    !selected.length || selected.some(value => !researchSources.includes(value as SourceId))) return null
  return { q: q.trim(), minutes: window as ResearchWindow, sources: researchSources.filter(id => selected.includes(id)) }
}

export type ResearchStatus = 'checked' | 'unconfigured' | 'cooldown' | 'unavailable' | 'limit' | 'access'
export type ResearchSource = {
  source: SourceId; status: ResearchStatus; count: number; requests: number; reviewed: number; indexed: boolean; partial?: boolean
  checkedFeeds?: string[]; unavailableFeeds?: string[]
}
export type ResearchPost = Pick<NormalizedPost, 'source' | 'title' | 'url' | 'posted_at' | 'author'> &
  { kind: 'hiring' | 'help' | 'topic'; excerpt: string }
export type ResearchResult = {
  query: string
  minutes: ResearchWindow
  checkedAt: string
  sources: ResearchSource[]
  posts: ResearchPost[]
}
export type ResearchState = { error?: string; result?: ResearchResult }

export function researchSnapshot(query: string, minutes: ResearchWindow, responses: {
  source: SourceId; status: ResearchStatus; indexed: boolean; posts: NormalizedPost[]
  checkedFeeds?: string[]; unavailableFeeds?: string[]; partial?: boolean
}[], checkedAt = new Date()): ResearchResult {
  const cutoff = checkedAt.getTime() - Number(minutes) * 60_000
  const plan = researchMatchPlan(query)
  const seen = new Set<string>()
  const posts: ResearchPost[] = []
  const summaries = responses.map(response => {
    let count = 0
    let reviewed = 0
    let requests = 0
    for (const post of response.posts) {
      const time = Date.parse(post.posted_at)
      if (response.status !== 'checked' || post.source !== response.source || post.posted_precision === 'day' || !Number.isFinite(time) ||
        time < cutoff || time > checkedAt.getTime() || seen.has(post.url)) continue
      seen.add(post.url)
      reviewed++
      const match = matchResearchPost(plan, post)
      if (!match) continue
      count++
      if (match.kind !== 'topic') requests++
      posts.push({ source: post.source, title: post.title, url: post.url, author: post.author, posted_at: post.posted_at, ...match })
    }
    return { source: response.source, status: response.status, indexed: response.indexed, count, reviewed, requests, partial: response.partial,
      checkedFeeds: response.checkedFeeds, unavailableFeeds: response.unavailableFeeds }
  })
  posts.sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at) || a.url.localeCompare(b.url))
  return { query, minutes, checkedAt: checkedAt.toISOString(), sources: summaries, posts }
}
