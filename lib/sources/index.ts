import { z } from 'zod'
import { admin } from '../db/admin'
import { bluesky, hn, stackexchange } from './api'
import { indexed, shopify } from './discovery'
import { matchResearchPost, researchMatchPlan } from '../research-matching'
import { maxJobAgeMs } from '../research-windows'
import { searchKeylessNetwork } from './keyless-research'
import {
  cleanPosts,
  ProviderBackoff,
  type Adapter,
  type SourceId,
} from './shared'
export { ProviderBackoff, sourceIds } from './shared'
export type { Adapter, NormalizedPost, SourceId } from './shared'
export const adapters: Record<SourceId, Adapter> = {
  hn,
  bluesky,
  stackexchange,
  shopify,
  reddit: indexed('reddit'),
  indiehackers: indexed('indiehackers'),
  x: indexed('x'),
  forums: indexed('forums'),
}
export function providerKey(id: string) {
  return ['reddit', 'x', 'indiehackers', 'forums'].includes(id) ? 'exa' : id
}
export async function searchPublic(skill: string, redditOnly = false) {
  const input = z.string().trim().min(2).max(100).parse(skill)
  const plan = researchMatchPlan(input)
  const since = new Date(Date.now() - maxJobAgeMs)
  const ids: SourceId[] = redditOnly
    ? ['reddit']
    : [
        'hn',
        'stackexchange',
        'bluesky',
        ...(/shopify/i.test(input) ? ['shopify' as const] : []),
      ]
  const db = admin()
  const tasks = await Promise.allSettled(
    ids.map(async (id) => {
      const source = providerKey(id)
      const gate = await db
        .from('source_backoffs')
        .select('retry_at')
        .eq('source', source)
        .maybeSingle()
      if (gate.error)
        throw new Error('Source availability could not be checked.')
      if (gate.data && Date.parse(gate.data.retry_at) > Date.now())
        throw new Error('Source is cooling down.')
      try {
        if (id === 'hn' || id === 'bluesky' || id === 'stackexchange') {
          const page = await searchKeylessNetwork(id, input, since)
          if (page.retryAt) {
            const { error } = await db.rpc('defer_source', { p_source: source, p_until: page.retryAt.toISOString() })
            if (error) throw new Error('Source cooldown could not be saved.')
          }
          return page.posts
        }
        return await adapters[id].search(input, since)
      } catch (error) {
        if (error instanceof ProviderBackoff) {
          const result = await db.rpc('defer_source', {
            p_source: source,
            p_until: error.retryAt.toISOString(),
          })
          if (result.error)
            throw new Error('Source cooldown could not be saved.')
        }
        throw error
      }
    }),
  )
  if (tasks.every((t) => t.status === 'rejected'))
    throw new Error('Search providers are temporarily unavailable.')
  const posts = tasks.flatMap((t) => (t.status === 'fulfilled' ? t.value : []))
  return cleanPosts(posts, new Date(Date.now() - maxJobAgeMs))
    .filter(post => {
      const match = post.posted_precision !== 'day' && matchResearchPost(plan, post)
      return match && match.kind !== 'topic'
    })
    .slice(0, 3)
}
