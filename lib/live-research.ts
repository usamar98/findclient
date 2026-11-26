import { matchJobListing, matchResearchPost, researchMatchPlan } from './research-matching'
import { isPaidSource, researchSources, type CandidateTime, type JobListing, type ResearchCandidate, type ResearchSourceId } from './research-catalog'
export { isPaidSource, keylessSources, paidSources, researchSources, researchSourceLabels, researchSourceNotes } from './research-catalog'
export type { ResearchSourceId } from './research-catalog'
export const researchWindows = { '1': 'Past minute', '15': 'Past 15 minutes', '60': 'Past hour', '1440': 'Past 24 hours' } as const
export type ResearchWindow = keyof typeof researchWindows

export function researchInput(form: FormData) {
  const q = form.get('q')
  const window = form.get('window')
  const selected = form.getAll('source')
  if (typeof q !== 'string' || q.trim().length > 100 ||
    typeof window !== 'string' || !Object.hasOwn(researchWindows, window) ||
    !selected.length || selected.some(value => !researchSources.includes(value as ResearchSourceId))) return null
  const sources = researchSources.filter(id => selected.includes(id))
  const query = q.trim()
  if (query.length < 2 && !(query === '' && sources.every(isPaidSource))) return null
  return { q: query, minutes: window as ResearchWindow, sources }
}

export type ResearchStatus = 'checked' | 'unconfigured' | 'cooldown' | 'unavailable' | 'limit' | 'access'
export type ResearchSource = {
  source: ResearchSourceId; status: ResearchStatus; count: number; requests: number; reviewed: number; indexed: boolean; partial?: boolean; durationMs?: number
  checkedFeeds?: string[]; unavailableFeeds?: string[]
}
export type ResearchPost = Pick<ResearchCandidate, 'source' | 'title' | 'url' | 'posted_at' | 'author'> &
  { kind: 'hiring' | 'help' | 'topic'; excerpt: string; engagement?: JobListing['engagement']; compensation?: string }
export type ResearchResult = {
  query: string
  minutes: ResearchWindow
  checkedAt: string
  durationMs?: number
  sources: ResearchSource[]
  posts: ResearchPost[]
}
export type ResearchState = { error?: string; result?: ResearchResult }

export function researchSnapshot(query: string, minutes: ResearchWindow, responses: {
  source: ResearchSourceId; status: ResearchStatus; indexed: boolean; posts: ResearchCandidate[]
  checkedFeeds?: string[]; unavailableFeeds?: string[]; partial?: boolean; durationMs?: number; candidates?: CandidateTime[]
}[], checkedAt = new Date()): ResearchResult {
  const end = checkedAt.getTime()
  const cutoff = end - Number(minutes) * 60_000
  function isFresh(candidate: CandidateTime) {
    const time = Date.parse(candidate.posted_at)
    return time >= cutoff && time <= end
  }
  const plan = researchMatchPlan(query)
  const seen = new Set<string>()
  const posts: ResearchPost[] = []
  const summaries = responses.map(response => {
    let count = 0
    const reviewed = new Set<string>()
    if (response.status === 'checked') {
      for (const item of response.candidates ?? []) if (isFresh(item)) reviewed.add(item.url)
    }
    let requests = 0
    for (const post of response.posts) {
      if (response.status !== 'checked' || post.source !== response.source || post.posted_precision === 'day' ||
        !isFresh(post) || seen.has(post.url)) continue
      seen.add(post.url)
      reviewed.add(post.url)
      const match = 'engagement' in post ? matchJobListing(plan, post, query === '') : matchResearchPost(plan, post)
      if (!match) continue
      count++
      if (match.kind !== 'topic') requests++
      posts.push({ source: post.source, title: post.title, url: post.url, author: post.author, posted_at: post.posted_at, ...match,
        ...('engagement' in post && { engagement: post.engagement, compensation: post.compensation }) })
    }
    return { source: response.source, status: response.status, indexed: response.indexed, count, reviewed: reviewed.size, requests, partial: response.partial,
      checkedFeeds: response.checkedFeeds, unavailableFeeds: response.unavailableFeeds, durationMs: response.durationMs }
  })
  posts.sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at) || a.url.localeCompare(b.url))
  return { query, minutes, checkedAt: checkedAt.toISOString(), sources: summaries, posts }
}
