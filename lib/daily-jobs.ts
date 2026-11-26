import 'server-only'
import { admin } from './db/admin'
import { researchSnapshot, type ResearchResult, type ResearchStatus } from './live-research'
import { paidSources, type CandidateTime, type PaidProjectPost, type PaidSourceId, type UnpricedContract } from './research-catalog'
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

export async function loadDailyJobFeed(selectedSource?: PaidSourceId): Promise<(query?: string) => ResearchResult> {
  const started = performance.now()
  const sources = selectedSource ? [selectedSource] : paidSources
  const db = admin()
  const gates = await db.from('source_backoffs').select('source,retry_at').in('source', sources)
  const cooldowns = new Map(gates.data?.map(gate => [gate.source, Date.parse(gate.retry_at)]))
  const since = new Date(Date.now() - 86_400_000)

  // All four readers use the same cacheable feed URLs across searches and users.
  // Apply the keyword filter and exact rolling cutoff after the source checks finish.
  const responses = await Promise.all(sources.map(async source => {
    const empty = (status: ResearchStatus) => ({ source, status, indexed: false, posts: [] })
    if (gates.error) return empty('unavailable')
    if ((cooldowns.get(source) ?? 0) > Date.now()) return empty('cooldown')
    try {
      const sourceStarted = performance.now()
      const { posts, unpricedContracts = [], candidates, partial, retryAt } = await paidListings(source, since)
      if (retryAt) await db.rpc('defer_source', { p_source: source, p_until: retryAt.toISOString() })
      return { source, status: 'checked' as const, indexed: false, posts: [...posts, ...unpricedContracts], candidates, partial,
        durationMs: Math.round(performance.now() - sourceStarted) }
    } catch (error) {
      if (error instanceof ProviderBackoff) {
        await db.rpc('defer_source', { p_source: source, p_until: error.retryAt.toISOString() })
        return empty('cooldown')
      }
      return empty(error instanceof Error && /^Source returned HTTP (401|402|403)$/.test(error.message) ? 'access' : 'unavailable')
    }
  }))
  const checkedAt = new Date()
  const durationMs = Math.round(performance.now() - started)
  return (query = '') => ({
    ...researchSnapshot(query.trim().slice(0, 100), '1440', responses, checkedAt),
    durationMs,
  })
}

export async function getDailyJobs(query = '', selectedSource?: PaidSourceId): Promise<ResearchResult> {
  const search = await loadDailyJobFeed(selectedSource)
  return search(query)
}
