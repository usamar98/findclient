import { validJobKeyword } from '../lead-title-search'
import type { ResearchStatus, SourceRead } from '../live-research'
import { matchResearchPost, paidProjectRequest, researchMatchPlan } from '../research-matching'
import { inPublicationWindow } from '../research-windows'
import { unpaid } from './contract-boards'
import { fetchShopifyResearchCandidates, shopifyFeedKeys } from './forum-feeds'
import { searchKeylessNetwork } from './keyless-research'
import { ProviderBackoff, type NormalizedPost } from './shared'

export type CommunityJobSource = 'hn' | 'bluesky' | 'shopify'
type Backoff = { source: string; retryAt: Date }
type JobRead = SourceRead & { backoffs: Backoff[] }

const excluded = /\b(?:job roundup|signal boost|reposting|boosting for reach|no freelancers?|no contractors?|volunteers? (?:wanted|needed)|(?:pay|budget|compensation) (?:is )?(?:zero|\$0)\b|(?:are you|if you(?:'re| are)?) (?:looking for|seeking|hiring)|you (?:should|can) (?:hire|post a job)|you need to hire|i(?:'m| am) (?:a|an) [^.!?]{1,65}(?:seeking|looking for) (?:projects?|opportunities))\b/i
const permanent = /\b(?:full[- ]time|permanent|salaried (?:position|role))\b/i
const freelance = /\b(?:freelanc(?:e|er|ers)|contractors?|contract (?:role|project|position|work)|contract[- ]to[- ]hire|fixed[- ]term)\b/i
const askingBuyer = /\b(?:(?:we(?:'re| are)|i(?:'m| am)|our (?:store|company|team|studio) is) (?:currently |actively |urgently )?(?:hiring|looking for|looking to hire|looking to commission|seeking|recruiting|in need of)|(?:we|i) (?:need|want to hire|would like to hire)|(?:seeking|looking for|hiring|need) (?:a |an |some )?(?:[\p{L}+#.-]+ ){0,3}(?:developers?|designers?|engineers?|freelancers?|contractors?|consultants?|specialists?|someone to)|(?:dm|send|share|email) (?:me |us )?(?:your |a )?(?:portfolio|rates?|quote|proposal))\b|^\s*(?:\[hiring\]|hiring\s*[:!]|(?:looking|want) to hire)\s*/iu

/** The Jobs page searches public posts at request time. Keep only buyer requests;
 * the wider Live Research view also surfaces support discussions. */
export async function searchCommunityJobs(source: CommunityJobSource, query: string, since: Date,
  cooldowns: ReadonlyMap<string, number> = new Map()): Promise<JobRead> {
  const started = performance.now()
  function report(status: ResearchStatus, posts: NormalizedPost[] = [], extra: Partial<JobRead> = {}): JobRead {
    return { source, indexed: false, status, posts, backoffs: [], durationMs: Math.round(performance.now() - started), ...extra }
  }
  const keys = source === 'shopify' ? shopifyFeedKeys : [source]
  if (keys.every(key => (cooldowns.get(key) ?? 0) > Date.now())) return report('cooldown')
  const keyword = query.trim()
  if (!validJobKeyword(keyword)) return report('checked')
  const plan = researchMatchPlan(keyword)
  const filter = (posts: NormalizedPost[]) => posts.filter(post => {
    if (post.posted_precision === 'day' || !inPublicationWindow(post.posted_at, since.getTime(), Date.now())) return false
    const text = (post.title + '\n' + post.body).replace(/https?:\/\/\S+/gi, ' ').replace(/[’‘]/g, "'")
    if (unpaid.test(text) || excluded.test(text) || (permanent.test(text) && !freelance.test(text))) return false
    const buyer = askingBuyer.test(text) || /^\s*(?:seeking|looking for|hiring) (?:a|an) /i.test(text) || paidProjectRequest(text)
    return buyer && matchResearchPost(plan, post)?.kind === 'hiring'
  })
  try {
    if (source === 'shopify') {
      const feed = await fetchShopifyResearchCandidates(since, cooldowns, true)
      const status = feed.checked.length ? 'checked' : feed.backoffs.length ? 'cooldown' : 'unavailable'
      return report(status, filter(feed.posts), { candidates: feed.posts, partial: feed.partial,
        checkedFeeds: feed.checked, unavailableFeeds: feed.unavailable, backoffs: feed.backoffs })
    }
    const feed = await searchKeylessNetwork(source, keyword, since, true)
    return report('checked', filter(feed.posts), { candidates: feed.posts, partial: feed.partial,
      checkedFeeds: ['Public posts'], backoffs: feed.retryAt ? [{ source, retryAt: feed.retryAt }] : [] })
  } catch (error) {
    if (error instanceof ProviderBackoff) return report('cooldown', [], { backoffs: [{ source, retryAt: error.retryAt }] })
    return report(error instanceof Error && /^Source returned HTTP (401|402|403)$/.test(error.message) ? 'access' : 'unavailable')
  }
}
