import { z } from 'zod'
import { closedRequest } from '../lead-intelligence'
import { readBlueskyPosts } from './api'
import { advertisedPay, unpaid } from './contract-boards'
import { apiURL, bodyText, plain, ProviderBackoff, remote } from './shared'

export type HiringPost = {
  source: 'hn' | 'bluesky'
  source_id: string
  title: string
  body: string
  url: string
  author: string
  posted_at: string
  engagement: 'paid_freelance' | 'contract_pay_unlisted'
  compensation?: string
}

type Feed = { posts: HiringPost[]; partial: boolean; retryAt?: Date; withdrawn?: string[] }
const id = z.number().int().positive()
const freelance = /\b(?:freelanc(?:e|er|ers)|contractors?|contract[- ]to[- ]hire|(?:temporary|fixed[- ]term|remote|short[- ]term|month|week) contract|contract (?:work|opportunity|role|position|job|project|engineer|developer|designer)|on (?:a )?contract basis|paid (?:project|gig|commission))\b|(?:^|[|·])\s*contract\s*(?:[|·]|$)/i
const buyer = /\b(?:(?:we(?:'re| are)|i(?:'m| am)|our (?:team|studio|company|agency) is) (?:currently |actively |urgently )?(?:hiring|looking (?:for|to hire|to commission)|seeking|recruiting|commissioning)|(?:i|we) (?:need (?:an? |someone)|want to hire|would like to (?:hire|commission))|(?:email|send|dm) (?:me|us) (?:your |a )?(?:portfolio|resume|proposal|rates?|quote))\b/i
const seller = /\b(?:for hire|hire me|open to work|seeking (?:work|clients|employment)|looking for (?:more |new )?(?:work|clients|(?:a |my next )?(?:job|gig|role|position)|(?:a |an? )?freelance (?:work|job|gigs?|opportunities|role|position))|available for (?:hire|work|commissions)|commissions (?:are )?open)\b/i
const excluded = /\b(?:(?:not|no longer) (?:currently )?(?:hiring|looking)|no (?:freelancers?|contractors?)|uncompensated|upfront (?:fee|payment required)|(?:no|not) (?:an? )?(?:freelance|contract)|if we (?:get|secure) funding|signal boost|reposting|job roundup)\b/i
const employerHeader = /^(?:seeking freelancers?\b|.{1,150}[|·]\s*(?:freelance|contract(?:or)?)(?:\s*[|·]|$))/i
const projectScope = /\b(?:one[- ]off|fixed[- ](?:fee|price)|project (?:fee|budget)|per project)\b/i

function classify(body: string, verifiedThread: boolean): Pick<HiringPost, 'engagement' | 'compensation'> | undefined {
  // URLs and hashtags can refer to opportunities unrelated to the author's own request.
  const text = body.replace(/https?:\/\/\S+|#[\p{L}\d_]+/gu, ' ').replace(/[’‘]/g, "'")
    .replace(/\b(?:smart|government|insurance) contracts?\b/gi, ' ')
  if (seller.test(text) || excluded.test(text) || unpaid.test(text) || closedRequest(text)) return
  const commission = /\b(?:i|we)(?:'m| am|'re| are)? (?:looking to|want to|would like to) commission (?:an? |someone)/i.test(text)
  if (!buyer.test(text) && !(verifiedThread && employerHeader.test(text)) && !commission) return
  const pay = advertisedPay(text)
  if (!freelance.test(text) && !commission && !(pay && projectScope.test(text))) return
  if (/\b(?:full[- ]time|permanent)\b/i.test(text) && !employerHeader.test(text) &&
      !/\b(?:hiring|seeking|looking for) (?:an? )?(?:freelance|contract(?:or)?)\b|\bcontract[- ]to[- ]hire\b/i.test(text)) return
  if (!pay && /\b(?:co[- ]?founder|(?:seeking|looking for) (?:an? )?(?:freelance |reliable )?(?:collaborator|business partner))\b/i.test(text)) return
  return pay ? { engagement: 'paid_freelance', ...pay } : { engagement: 'contract_pay_unlisted' }
}

async function json(url: URL, ttl: number, deadline = Infinity) {
  const remaining = Math.ceil(deadline - performance.now())
  if (remaining <= 0) throw new Error('Source check timed out')
  const response = await remote(url, { cache: 'force-cache', next: { revalidate: ttl }, signal: AbortSignal.timeout(Math.min(4500, remaining)) })
  return JSON.parse(await bodyText(response, 2_000_000)) as unknown
}

const firebase = 'https://hacker-news.firebaseio.com/v0/'
const item = z.object({
  id, by: z.string().optional(), time: id.optional(), text: z.string().optional(), type: z.string().optional(),
  title: z.string().optional(), kids: z.array(id).optional(), parent: id.optional(),
  deleted: z.boolean().optional(), dead: z.boolean().optional(),
})
async function hnItem(itemId: number, deadline: number) {
  const row = item.nullable().parse(await json(new URL('item/' + itemId + '.json', firebase), 60, deadline))
  if (row && row.id !== itemId) throw new Error('Unexpected Hacker News item')
  return row
}

async function hackerNews(since: Date): Promise<Feed> {
  const deadline = performance.now() + 18_000
  const user = z.object({ id: z.literal('whoishiring'), submitted: z.array(id) }).parse(
    await json(new URL('user/whoishiring.json', firebase), 300, deadline),
  )
  // The account also publishes job-seeker threads. Only collect direct children
  // of its employer threads; the child comment's own timestamp defines freshness.
  const threads = await Promise.allSettled(user.submitted.slice(0, 6).map(itemId => hnItem(itemId, deadline)))
  const children = new Map<number, number>()
  let partial = false
  let failed: unknown
  let retryAt: Date | undefined
  function recordError(error: unknown) {
    partial = true
    failed = error
    if (error instanceof ProviderBackoff && (!retryAt || error.retryAt > retryAt)) retryAt = error.retryAt
  }
  for (const thread of threads) {
    if (thread.status === 'rejected') { recordError(thread.reason); continue }
    const row = thread.value
    if (row?.type !== 'story' || row.deleted || row.dead || row.by !== 'whoishiring' ||
        !/^Ask HN:\s*(?:Who is hiring\?|Freelancer\? Seeking freelancer\?)\s*\(/i.test(row.title ?? '')) continue
    for (const child of row.kids ?? []) children.set(child, row.id)
  }
  if (retryAt) throw new ProviderBackoff(retryAt)
  if (!children.size && failed) throw failed
  // 'kids' uses HN's display order. Look at the highest IDs across the eligible
  // threads first so a new request on a previous month's thread can still qualify.
  const ids = [...children.keys()].sort((a, b) => b - a)
  const posts: HiringPost[] = []
  const withdrawn: string[] = []
  let reachedCutoff = false, succeeded = 0
  for (let offset = 0; offset < Math.min(ids.length, 48); offset += 8) {
    if (performance.now() >= deadline) { partial = true; break }
    const results = await Promise.allSettled(ids.slice(offset, offset + 8).map(child => hnItem(child, deadline)))
    for (const result of results) {
      if (result.status === 'rejected') { recordError(result.reason); continue }
      succeeded++
      const row = result.value
      // An explicit tombstone can lack text, parent and time. The ID has
      // already been checked against the child requested from the source.
      if (row?.deleted || row?.dead) { withdrawn.push(String(row.id)); continue }
      if (row?.type !== 'comment' || row.parent !== children.get(row.id) || !row.time || !row.by || !row.text) continue
      const time = row.time * 1000
      if (time < +since) { reachedCutoff = true; continue }
      if (time > Date.now()) continue
      const body = plain(row.text).slice(0, 4500)
      if (closedRequest(body.replace(/[’‘]/g, "'"))) { withdrawn.push(String(row.id)); continue }
      const engagement = classify(body, true)
      if (engagement) posts.push({
        source: 'hn', source_id: String(row.id), url: 'https://news.ycombinator.com/item?id=' + row.id,
        author: row.by.slice(0, 120), title: body.slice(0, 180), body, posted_at: new Date(time).toISOString(), ...engagement,
      })
    }
    if (reachedCutoff || retryAt) break
  }
  if (ids.length && !succeeded && failed) throw retryAt ? new ProviderBackoff(retryAt) : failed
  return { posts, partial: partial || (!reachedCutoff && ids.length > 48), retryAt, withdrawn }
}

const labels = z.array(z.object({ val: z.string() })).optional()
const originalPost = z.object({
  uri: z.string(), labels, author: z.object({ labels, displayName: z.string().optional() }),
  record: z.object({ $type: z.literal('app.bsky.feed.post').optional(), reply: z.never().optional(),
    embed: z.object({ $type: z.string() }).optional() }),
})
const filteredLabels = new Set(['!no-unauthenticated', '!hide', '!takedown', 'porn', 'sexual', 'graphic-media'])
const jobBoardName = /\bjobs? (?:board|feed|alerts?|listings?|bot)\b|(?:^|[|•])\s*(?:[\w&+ -]{0,40} )?(?:jobs|vacancies)\s*$/i
const terms = ['freelance hiring', '"looking for a freelance"', '"looking to hire"', '"looking to commission"']

async function bluesky(since: Date): Promise<Feed> {
  const posts = new Map<string, HiringPost>()
  const withdrawn = new Set<string>()
  const start = new Date(Math.floor(+since / 60_000) * 60_000).toISOString()
  let successes = 0, partial = false, failed: unknown
  for (const term of terms) {
    try {
      const url = apiURL('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts', { q: term, since: start, sort: 'latest', limit: '50' })
      const data = z.object({ posts: z.array(z.unknown()).max(50), cursor: z.string().optional() }).parse(await json(url, 30))
      successes++
      partial ||= Boolean(data.cursor && data.posts.length >= 50)
      for (const value of data.posts) {
        const parsed = originalPost.safeParse(value)
        if (!parsed.success) continue
        const original = parsed.data
        // The existing parser checks the AT URI against the author's DID and
        // uses record.createdAt, even if the AppView indexed the record later.
        const [post] = readBlueskyPosts([value], since)
        if (!post || withdrawn.has(original.uri)) continue
        if ([...original.labels ?? [], ...original.author.labels ?? []].some(label => filteredLabels.has(label.val)) ||
            closedRequest(post.body.replace(/[’‘]/g, "'"))) {
          withdrawn.add(original.uri)
          posts.delete(original.uri)
          continue
        }
        if (posts.has(original.uri) || jobBoardName.test(original.author.displayName ?? '') || original.record.embed?.$type.startsWith('app.bsky.embed.record')) continue
        const engagement = classify(post.body, false)
        if (engagement) posts.set(original.uri, { ...post, source: 'bluesky', source_id: original.uri, ...engagement })
      }
    } catch (error) {
      partial = true
      failed = error
      if (error instanceof ProviderBackoff) break
    }
  }
  if (!successes && failed) throw failed
  return { posts: [...posts.values()], partial, retryAt: failed instanceof ProviderBackoff ? failed.retryAt : undefined,
    withdrawn: [...withdrawn] }
}

export function readHiringSource(source: HiringPost['source'], since: Date): Promise<Feed> {
  return source === 'hn' ? hackerNews(since) : bluesky(since)
}
