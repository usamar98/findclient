'use server'

import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { adapters, providerKey, ProviderBackoff, type SourceId, type NormalizedPost } from '@/lib/sources'
import { redditRecent, xRecent } from '@/lib/sources/research-social'
import { FeedAccessRestricted, forumFeedKeys, searchForumFeeds, shopifyRecent } from '@/lib/sources/forum-feeds'
import { researchInput, researchSnapshot, type ResearchState, type ResearchStatus } from '@/lib/live-research'

function liveProvider(id: SourceId) {
  if (id === 'forums') return 'forums'
  if (id === 'x' && process.env.X_BEARER_TOKEN) return 'x'
  if (id === 'reddit' && process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USER_AGENT) return 'reddit'
  return providerKey(id)
}

export async function findFreshPosts(_previous: ResearchState, form: FormData): Promise<ResearchState> {
  const { user } = await requireUser()
  const input = researchInput(form)
  if (!input) return { error: 'Enter 2–100 characters and choose a time window and at least one platform.' }
  const db = admin()
  const budget = await db.rpc('allow_request', { p_key: 'live-research:' + user.id, p_limit: 10, p_window: 600 })
  if (budget.error) return { error: 'Live search is temporarily unavailable. Please try again.' }
  if (!budget.data) return { error: 'You have run 10 searches in 10 minutes. Try again shortly.' }

  const { q, minutes } = input
  const providers = [...new Set(input.sources.map(liveProvider))]
  const gateKeys = providers.includes('forums') ? [...providers, ...forumFeedKeys] : providers
  const gates = await db.from('source_backoffs').select('source,retry_at').in('source', gateKeys)
  if (gates.error) return { error: 'Source availability could not be checked. Please try again.' }
  const cooldowns = new Map(gates.data.map(gate => [gate.source, Date.parse(gate.retry_at)]))
  const since = new Date(Date.now() - Number(minutes) * 60_000)
  async function check(source: SourceId) {
    const provider = liveProvider(source)
    const indexed = provider === 'exa'
    const report = (status: ResearchStatus, posts: NormalizedPost[] = []) => ({ source, indexed, status, posts })
    if (indexed && !process.env.EXA_API_KEY) return report('unconfigured')
    if ((cooldowns.get(provider) ?? 0) > Date.now()) return report('cooldown')
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
      if (source === 'forums') {
        const feeds = await searchForumFeeds(q, since, cooldowns)
        await Promise.all(feeds.backoffs.map(gate => db.rpc('defer_source', { p_source: gate.source, p_until: gate.retryAt.toISOString() })))
        return { ...report(feeds.checked.length ? 'checked' : 'unavailable', feeds.posts), checkedFeeds: feeds.checked, unavailableFeeds: feeds.unavailable }
      }
      const native = { reddit: redditRecent, x: xRecent, shopify: shopifyRecent }
      const adapter = provider === 'reddit' || provider === 'x' || provider === 'shopify' ? native[provider] : adapters[source]
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
    for (const id of input.sources.filter(id => liveProvider(id) === provider)) results.push(await check(id))
    return results
  }))
  const ordered = batches.flat().sort((a, b) => input.sources.indexOf(a.source) - input.sources.indexOf(b.source))
  return { result: researchSnapshot(q, minutes, ordered) }
}
