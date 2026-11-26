'use server'

import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { adapters, providerKey, ProviderBackoff } from '@/lib/sources'
import { redditRecent, xRecent } from '@/lib/sources/research-social'
import { FeedAccessRestricted, forumFeedKeys, shopifyFeedKeys, fetchForumResearchCandidates, fetchShopifyResearchCandidates } from '@/lib/sources/forum-feeds'
import { searchKeylessNetwork } from '@/lib/sources/keyless-research'
import { searchContractBoard } from '@/lib/sources/contract-boards'
import { searchPublicProjects } from '@/lib/sources/public-projects'
import { searchMastodonJobs } from '@/lib/sources/mastodon-jobs'
import { isPaidSource, type CandidateTime, type PaidSourceId, type PaidProjectPost, type ResearchCandidate, type ResearchSourceId } from '@/lib/research-catalog'
import { researchInput, researchSnapshot, type ResearchState, type ResearchStatus } from '@/lib/live-research'

function liveProvider(id: ResearchSourceId) {
  if (isPaidSource(id)) return id
  if (id === 'forums') return 'forums'
  if (id === 'x' && process.env.X_BEARER_TOKEN) return 'x'
  if (id === 'reddit' && process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USER_AGENT) return 'reddit'
  return providerKey(id)
}

function paidListings(source: PaidSourceId, since: Date): Promise<{posts: PaidProjectPost[]; partial: boolean; retryAt?: Date; candidates?: CandidateTime[]}> {
  switch (source) {
    case 'github': return searchPublicProjects(source, since)
    case 'mastodon': return searchMastodonJobs(since)
    default: return searchContractBoard(source, since)
  }
}

export async function findFreshPosts(_previous: ResearchState, form: FormData): Promise<ResearchState> {
  const started = performance.now()
  const { user } = await requireUser()
  const input = researchInput(form)
  if (!input) return { error: 'Choose a time window and at least one platform. Enter 2–100 characters, or select only paid freelance platforms to browse without keywords.' }
  const db = admin()
  const budget = await db.rpc('allow_request', { p_key: 'live-research:' + user.id, p_limit: 10, p_window: 600 })
  if (budget.error) return { error: 'Live search is temporarily unavailable. Please try again.' }
  if (!budget.data) return { error: 'You have run 10 searches in 10 minutes. Try again shortly.' }

  const { q, minutes } = input
  const providers = [...new Set(input.sources.map(liveProvider))]
  const gateKeys = [...providers, ...(providers.includes('forums') ? forumFeedKeys : []), ...(providers.includes('shopify') ? shopifyFeedKeys : [])]
  const gates = await db.from('source_backoffs').select('source,retry_at').in('source', gateKeys)
  if (gates.error) return { error: 'Source availability could not be checked. Please try again.' }
  const cooldowns = new Map(gates.data.map(gate => [gate.source, Date.parse(gate.retry_at)]))
  const since = new Date(Date.now() - Number(minutes) * 60_000)
  async function check(source: ResearchSourceId) {
    const provider = liveProvider(source)
    const indexed = provider === 'exa'
    const report = (status: ResearchStatus, posts: ResearchCandidate[] = []) => ({ source, indexed, status, posts })
    if (indexed && !process.env.EXA_API_KEY) return report('unconfigured')
    // The merchant and developer forums can throttle independently.
    if (source !== 'shopify' && (cooldowns.get(provider) ?? 0) > Date.now()) return report('cooldown')
    if (indexed || provider === 'x' || provider === 'reddit') {
      const daily = await db.rpc('allow_request', { p_key: 'live-metered:' + user.id, p_limit: 40, p_window: 86400 })
      if (daily.error) return report('unavailable')
      if (!daily.data) return report('limit')
      const projectLimit = Number(process.env.LIVE_RESEARCH_DAILY_PROVIDER_LIMIT?.trim() || 100)
      if (!Number.isSafeInteger(projectLimit) || projectLimit < 1 || projectLimit > 2147483647) return report('limit')
      const shared = await db.rpc('allow_request', { p_key: 'live-metered:project', p_limit: projectLimit, p_window: 86400 })
      if (shared.error) return report('unavailable')
      if (!shared.data) return report('limit')
    }
    try {
      if (isPaidSource(source)) {
        const listings = await paidListings(source, since)
        if (listings.retryAt) await db.rpc('defer_source', { p_source: provider, p_until: listings.retryAt.toISOString() })
        return { ...report('checked', listings.posts), partial: listings.partial, candidates: listings.candidates }
      }
      if (source === 'forums' || source === 'shopify') {
        const feeds = source === 'forums' ? await fetchForumResearchCandidates(since, cooldowns) : await fetchShopifyResearchCandidates(since, cooldowns)
        await Promise.all(feeds.backoffs.map(gate => db.rpc('defer_source', { p_source: gate.source, p_until: gate.retryAt.toISOString() })))
        return { ...report(feeds.checked.length ? 'checked' : 'unavailable', feeds.posts), partial: feeds.partial, checkedFeeds: feeds.checked, unavailableFeeds: feeds.unavailable }
      }
      if (source === 'hn' || source === 'bluesky' || source === 'stackexchange') {
        const network = await searchKeylessNetwork(source, q, since)
        if (network.retryAt) await db.rpc('defer_source', { p_source: provider, p_until: network.retryAt.toISOString() })
        return { ...report('checked', network.posts), partial: network.partial }
      }
      const adapter = provider === 'reddit' ? redditRecent : provider === 'x' ? xRecent : adapters[source]
      return report('checked', await adapter.search(q, since))
    } catch (error) {
      if (error instanceof ProviderBackoff) {
        cooldowns.set(provider, error.retryAt.getTime())
        await db.rpc('defer_source', { p_source: provider, p_until: error.retryAt.toISOString() })
        return report('cooldown')
      }
      if (error instanceof FeedAccessRestricted || (error instanceof Error && /^Source returned HTTP (401|402|403)$/.test(error.message))) return report('access')
      return report('unavailable')
    }
  }
  // Sources sharing an index also share its rate-limit signal.
  const batches = await Promise.all(providers.map(async provider => {
    const results = []
    for (const id of input.sources.filter(id => liveProvider(id) === provider)) {
      const sourceStarted = performance.now()
      const response = await check(id)
      results.push({ ...response, durationMs: Math.round(performance.now() - sourceStarted) })
    }
    return results
  }))
  const ordered = batches.flat().sort((a, b) => input.sources.indexOf(a.source) - input.sources.indexOf(b.source))
  const result = researchSnapshot(q, minutes, ordered)
  result.durationMs = Math.round(performance.now() - started)
  return { result }
}
