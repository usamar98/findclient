import { matchJobListing, matchResearchPost, researchMatchPlan } from './research-matching'
import { validJobKeyword } from './lead-title-search'
import { inPublicationWindow, researchWindows, type ResearchWindow } from './research-windows'
import { isPaidSource, researchSources, type CandidateTime, type JobListing, type ResearchCandidate, type ResearchSourceId } from './research-catalog'
export { isPaidSource, keylessSources, paidSources, researchSources, researchSourceLabels, researchSourceNotes } from './research-catalog'
export type { ResearchSourceId } from './research-catalog'
export { researchWindows, type ResearchWindow } from './research-windows'

export function researchInput(form: FormData) {
  const q = form.get('q')
  const window = form.get('window')
  const selected = form.getAll('source')
  if (typeof q !== 'string' || q.trim().length > 100 ||
    typeof window !== 'string' || !Object.hasOwn(researchWindows, window) ||
    !selected.length || selected.some(value => !researchSources.includes(value as ResearchSourceId))) return null
  const sources = researchSources.filter(id => selected.includes(id))
  const query = q.trim()
  if (!validJobKeyword(query) && !(query === '' && sources.every(isPaidSource))) return null
  return { q: query, minutes: window as ResearchWindow, sources }
}

export type ResearchStatus = 'checked' | 'delayed' | 'unconfigured' | 'cooldown' | 'unavailable' | 'limit' | 'access'
export type ResearchSource = {
  source: ResearchSourceId; status: ResearchStatus; count: number; requests: number; reviewed: number; openings?: number; indexed: boolean; partial?: boolean; durationMs?: number
  checkedFeeds?: string[]; unavailableFeeds?: string[]; lastCheckedAt?: string
}
export type ResearchPost = Pick<ResearchCandidate, 'source' | 'title' | 'url' | 'posted_at' | 'author'> &
  { kind: 'hiring' | 'help' | 'topic'; excerpt: string; engagement?: JobListing['engagement']; compensation?: string; first_found_at?: string }
export type ResearchResult = {
  query: string
  minutes: ResearchWindow
  checkedAt: string
  durationMs?: number
  sources: ResearchSource[]
  posts: ResearchPost[]
}
export type ResearchState = { error?: string; result?: ResearchResult }

export type SourceRead = {
  source: ResearchSourceId; status: ResearchStatus; indexed: boolean; posts: ResearchCandidate[]
  checkedFeeds?: string[]; unavailableFeeds?: string[]; partial?: boolean; durationMs?: number; candidates?: CandidateTime[]; lastCheckedAt?: string
}

/** Keep the job record first when a post also appears in the live community search. */
export function combineHiringReads(live: SourceRead, hiring: SourceRead): SourceRead {
  const liveOk = live.status === 'checked'
  const feedOk = hiring.status === 'checked'
  const hasSaved = hiring.posts.length > 0
  return {
    ...live,
    status: liveOk || feedOk || hasSaved ? 'checked' : live.status,
    posts: [...hiring.posts, ...live.posts],
    partial: Boolean(live.partial || hiring.partial || !liveOk || !feedOk),
    checkedFeeds: [...(liveOk ? ['Community search'] : []), ...(feedOk ? ['Shared hiring feed'] : hasSaved ? ['Saved hiring posts'] : [])],
    unavailableFeeds: [...(liveOk ? [] : ['Community search']), ...(feedOk ? [] : ['Shared hiring feed refresh'])],
    lastCheckedAt: hiring.lastCheckedAt,
  }
}

export function researchSnapshot(query: string, minutes: ResearchWindow, responses: SourceRead[], checkedAt = new Date(), onlyHiring = false): ResearchResult {
  const end = checkedAt.getTime()
  const cutoff = end - Number(minutes) * 60_000
  function isFresh(candidate: CandidateTime) {
    return inPublicationWindow(candidate.posted_at, cutoff, end)
  }
  const plan = researchMatchPlan(query)
  const seen = new Set<string>()
  const posts: ResearchPost[] = []
  const summaries = responses.map(response => {
    let count = 0
    const reviewed = new Set<string>()
    const openings = new Set<string>()
    if (response.status === 'checked') {
      for (const item of response.candidates ?? []) if (isFresh(item)) reviewed.add(item.url)
    }
    let requests = 0
    for (const post of response.posts) {
      if (response.status !== 'checked' || post.source !== response.source || post.posted_precision === 'day' ||
        !isFresh(post) || seen.has(post.url)) continue
      reviewed.add(post.url)
      const match = 'engagement' in post ? matchJobListing(plan, post, query === '') : matchResearchPost(plan, post)
      if (onlyHiring && ('engagement' in post || match?.kind === 'hiring')) openings.add(post.url)
      if (!match || (onlyHiring && match.kind !== 'hiring')) continue
      seen.add(post.url)
      count++
      if (match.kind !== 'topic') requests++
      posts.push({ source: post.source, title: post.title, url: post.url, author: post.author, posted_at: post.posted_at, ...match,
        ...('engagement' in post && { engagement: post.engagement, compensation: post.compensation, first_found_at: post.first_found_at }) })
    }
    return { source: response.source, status: response.status, indexed: response.indexed, count, reviewed: reviewed.size, ...(onlyHiring && { openings: openings.size }), requests, partial: response.partial,
      checkedFeeds: response.checkedFeeds, unavailableFeeds: response.unavailableFeeds, durationMs: response.durationMs, lastCheckedAt: response.lastCheckedAt }
  })
  posts.sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at) || a.url.localeCompare(b.url))
  return { query, minutes, checkedAt: checkedAt.toISOString(), sources: summaries, posts }
}
