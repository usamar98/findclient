import 'server-only'
import { admin } from './db/admin'
import { combineHiringReads, researchSnapshot, type ResearchResult, type SourceRead } from './live-research'
import { dailyJobSources, dailySearchSources, isPaidSource, sourceCanPublishInWindow, type CandidateTime, type DailySearchSource, type PaidProjectPost, type PaidSourceId, type UnpricedContract } from './research-catalog'
import { validJobKeyword } from './lead-title-search'
import { readSharedHiringFeed, stampJobDiscoveries } from './shared-hiring-feed'
import { searchContractBoard } from './sources/contract-boards'
import { searchOpenJobBoard } from './sources/open-job-boards'
import type { ResearchWindow } from './research-windows'
import { searchMastodonJobs } from './sources/mastodon-jobs'
import { searchPublicProjects } from './sources/public-projects'
import { ProviderBackoff } from './sources/shared'
import { searchCommunityJobs } from './sources/community-job-search'
import { shopifyFeedKeys } from './sources/forum-feeds'

type PaidListings = { posts: PaidProjectPost[]; unpricedContracts?: UnpricedContract[]; partial: boolean; retryAt?: Date; candidates?: CandidateTime[] }

export function paidListings(source: PaidSourceId, since: Date, query = ''): Promise<PaidListings> {
  switch (source) {
    case 'github': return searchPublicProjects(source, since, query)
    case 'mastodon': return searchMastodonJobs(since)
    case 'jobicy':
    case 'jobtech': return searchOpenJobBoard(source, since, query)
    default: return searchContractBoard(source, since)
  }
}

export async function loadDailyJobFeed(selectedSource?: DailySearchSource, minutes: ResearchWindow = '1440', keyword = ''): Promise<(query?: string) => ResearchResult> {
  const started = performance.now()
  const sources: readonly DailySearchSource[] = selectedSource ? [selectedSource] : keyword ? dailySearchSources : dailyJobSources
  const since = new Date(Date.now() - Number(minutes) * 60_000)
  const communities = sources.filter((source): source is 'hn' | 'bluesky' => source === 'hn' || source === 'bluesky')
  const empty = (source: DailySearchSource, status: SourceRead['status']): SourceRead => ({ source, status, indexed: false, posts: [] })
  const shared = readSharedHiringFeed(communities, since).catch(() => communities.map(id => empty(id, 'unavailable')))
  const db = admin()
  const gateKeys = new Set<string>(sources)
  if (gateKeys.has('shopify')) for (const key of shopifyFeedKeys) gateKeys.add(key)
  const gates = await db.from('source_backoffs').select('source,retry_at').in('source', [...gateKeys])
  const cooldowns = new Map(gates.data?.map(gate => [gate.source, Date.parse(gate.retry_at)]))
  async function readSource(source: DailySearchSource): Promise<SourceRead> {
    if (!sourceCanPublishInWindow(source, minutes)) return empty(source, 'delayed')
    if (gates.error) return empty(source, 'unavailable')
    try {
      if (!isPaidSource(source)) {
        const { backoffs, ...result } = await searchCommunityJobs(source, keyword, since, cooldowns)
        await Promise.all(backoffs.map(gate => db.rpc('defer_source', { p_source: gate.source, p_until: gate.retryAt.toISOString() })))
        return result
      }
      if ((cooldowns.get(source) ?? 0) > Date.now()) return empty(source, 'cooldown')
      const listings = await paidListings(source, since, keyword)
      if (listings.retryAt) await db.rpc('defer_source', { p_source: source, p_until: listings.retryAt.toISOString() })
      const jobs = await stampJobDiscoveries([...listings.posts, ...(listings.unpricedContracts ?? [])])
      return { source, status: 'checked', indexed: false, posts: jobs, candidates: listings.candidates, partial: listings.partial }
    } catch (error) {
      if (error instanceof ProviderBackoff) {
        await db.rpc('defer_source', { p_source: source, p_until: error.retryAt.toISOString() })
        return empty(source, 'cooldown')
      }
      return empty(source, error instanceof Error && /^Source returned HTTP (401|402|403)$/.test(error.message) ? 'access' : 'unavailable')
    }
  }
  const responses = await Promise.all(sources.map(async source => {
    const sourceStarted = performance.now()
    const useLiveSearch = validJobKeyword(keyword)
    const direct = isPaidSource(source) || useLiveSearch ? await readSource(source) : undefined
    if (source === 'hn' || source === 'bluesky') {
      const hiring = (await shared).find(row => row.source === source) ?? empty(source, 'unavailable')
      if (direct) return combineHiringReads(direct, hiring)
      if (hiring.status !== 'checked' && hiring.posts.length)
        return { ...hiring, status: 'checked' as const, partial: true, unavailableFeeds: ['Hiring feed refresh'] }
      return hiring
    }
    return { ...(direct ?? empty(source, 'unavailable')), durationMs: Math.round(performance.now() - sourceStarted) }
  }))
  const checkedAt = new Date()
  const durationMs = Math.round(performance.now() - started)
  return (query = '') => ({
    ...researchSnapshot(query.trim().slice(0, 100), minutes, responses, checkedAt, true),
    durationMs,
  })
}

export async function getDailyJobs(query = '', selectedSource?: DailySearchSource, minutes: ResearchWindow = '1440'): Promise<ResearchResult> {
  const keyword = query.trim().slice(0, 100)
  const search = await loadDailyJobFeed(selectedSource, minutes, keyword)
  return search(keyword)
}
