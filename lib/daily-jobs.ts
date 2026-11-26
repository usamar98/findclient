import 'server-only'
import { admin } from './db/admin'
import { researchSnapshot, type ResearchResult, type ResearchStatus } from './live-research'
import { dailyJobSources, isPaidSource, type CandidateTime, type DailyJobSource, type PaidProjectPost, type PaidSourceId, type UnpricedContract } from './research-catalog'
import { readSharedHiringFeed, stampJobDiscoveries } from './shared-hiring-feed'
import { searchContractBoard } from './sources/contract-boards'
import { searchMastodonJobs } from './sources/mastodon-jobs'
import { searchPublicProjects } from './sources/public-projects'
import { ProviderBackoff } from './sources/shared'

type PaidListings = { posts: PaidProjectPost[]; unpricedContracts?: UnpricedContract[]; partial: boolean; retryAt?: Date; candidates?: CandidateTime[] }

export function paidListings(source: PaidSourceId, since: Date): Promise<PaidListings> {
  switch (source) {
    case 'github': return searchPublicProjects(source, since)
    case 'mastodon': return searchMastodonJobs(since)
    default: return searchContractBoard(source, since)
  }
}

async function readJobBoards(sources: PaidSourceId[], since: Date) {
  if (!sources.length) return []
  const db = admin()
  const gates = await db.from('source_backoffs').select('source,retry_at').in('source', sources)
  const cooldowns = new Map(gates.data?.map(gate => [gate.source, Date.parse(gate.retry_at)]))
  return Promise.all(sources.map(async source => {
    const empty = (status: ResearchStatus) => ({ source, status, indexed: false, posts: [] })
    if (gates.error) return empty('unavailable')
    if ((cooldowns.get(source) ?? 0) > Date.now()) return empty('cooldown')
    try {
      const sourceStarted = performance.now()
      const { posts, unpricedContracts = [], candidates, partial, retryAt } = await paidListings(source, since)
      if (retryAt) await db.rpc('defer_source', { p_source: source, p_until: retryAt.toISOString() })
      const jobs = await stampJobDiscoveries([...posts, ...unpricedContracts])
      return { source, status: 'checked' as const, indexed: false, posts: jobs, candidates, partial,
        durationMs: Math.round(performance.now() - sourceStarted) }
    } catch (error) {
      if (error instanceof ProviderBackoff) {
        await db.rpc('defer_source', { p_source: source, p_until: error.retryAt.toISOString() })
        return empty('cooldown')
      }
      return empty(error instanceof Error && /^Source returned HTTP (401|402|403)$/.test(error.message) ? 'access' : 'unavailable')
    }
  }))
}

export async function loadDailyJobFeed(selectedSource?: DailyJobSource): Promise<(query?: string) => ResearchResult> {
  const started = performance.now()
  const sources = selectedSource ? [selectedSource] : dailyJobSources
  const since = new Date(Date.now() - 86_400_000)
  const communities = sources.filter(source => source === 'hn' || source === 'bluesky')
  const [boards, hiring] = await Promise.all([
    readJobBoards(sources.filter(isPaidSource), since),
    communities.length ? readSharedHiringFeed(communities, since) : [],
  ])
  const responses = [...boards, ...hiring.map(row => row.status !== 'checked' && row.posts.length
    ? { ...row, status: 'checked' as const, partial: true, unavailableFeeds: ['Hiring feed refresh'] }
    : row)]
  const checkedAt = new Date()
  const durationMs = Math.round(performance.now() - started)
  return (query = '') => ({
    ...researchSnapshot(query.trim().slice(0, 100), '1440', responses, checkedAt),
    durationMs,
  })
}

export async function getDailyJobs(query = '', selectedSource?: DailyJobSource): Promise<ResearchResult> {
  const search = await loadDailyJobFeed(selectedSource)
  return search(query)
}
