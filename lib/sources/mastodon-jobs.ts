import { Parser } from 'htmlparser2'
import { z } from 'zod'
import { closedRequest } from '../lead-intelligence'
import type { PaidProjectPost } from '../research-catalog'
import { advertisedPay } from './contract-boards'
import { bodyText, remote } from './shared'

const tags = ['hiring', 'fedihire', 'freelance', 'gamedevjobs']
const endpoint = new URL('https://mastodon.social/api/v1/timelines/tag/hiring')
for (const tag of tags.slice(1)) endpoint.searchParams.append('any[]', tag)
endpoint.searchParams.set('limit', '40')

const status = z.object({
  id: z.string().regex(/^\d+$/), url: z.string(), uri: z.string(), content: z.string(),
  created_at: z.iso.datetime({offset:true}), visibility: z.literal('public'), sensitive: z.literal(false),
  in_reply_to_id: z.null(), in_reply_to_account_id: z.null(), reblog: z.null(),
  quote: z.null().optional(), quote_id: z.null().optional(), spoiler_text: z.literal('').optional(),
  account: z.object({ url: z.string(), uri: z.string().optional(), acct: z.string(), bot: z.literal(false), indexable: z.literal(true), noindex: z.literal(false).nullish(),
    suspended: z.literal(false).optional(), limited: z.literal(false).optional(), moved: z.null().optional() }),
  tags: z.array(z.object({name:z.string()})),
})

function originalStatus(row: z.infer<typeof status>) {
  try {
    const url = new URL(row.url), actor = new URL(row.account.url), uri = new URL(row.uri)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
        url.origin !== actor.origin || url.origin !== uri.origin || !/\.[a-z]{2,}$/i.test(url.hostname) || /\.(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)) return
    const post = /^\/@([\w.-]+)\/(\d+)$/.exec(url.pathname)
    if (!post || actor.pathname !== '/@' + post[1]) return
    const actorUri = row.account.uri ?? (actor.origin + '/users/' + post[1])
    if (uri.href !== actorUri + '/statuses/' + post[2]) return
    const local = url.hostname === 'mastodon.social'
    const acct = post[1] + (local ? '' : '@' + url.hostname)
    if (row.account.acct.toLowerCase() !== acct.toLowerCase() || (local && post[2] !== row.id)) return
    return url.href
  } catch { return }
}

// Use the poster's words; an external link's label, hashtag, quote, or mention
// does not establish who is hiring or what rate they have offered.
function authorText(html: string) {
  let skip = 0
  const parts: string[] = []
  const parser = new Parser({
    onopentag(name) {
      if (skip || ['a','blockquote','q','script','style','aside'].includes(name)) skip++
      else if (['p','div','br','li'].includes(name)) parts.push(' ')
    },
    onclosetag(name) { if (skip) skip--; else if (['p','div','li'].includes(name)) parts.push(' ') },
    ontext(value) { if (!skip) parts.push(value) },
  })
  parser.end(html)
  return parts.join('').replace(/https?:\/\/\S+|\B@[\w.]+(?:@[\w.-]+)?|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, ' ')
    .replace(/\s+/g, ' ').trim()
}

const employer = /\b(?:(?:we(?:'re| are)|i(?:'m| am)|our (?:company|team|studio|agency) is) (?:currently |actively |urgently )?(?:hiring|looking for|seeking|recruiting|commissioning)|(?:we|i) (?:need|want to hire|would like to hire)|(?:join|apply to) our team|(?:work|collaborate) with us|(?:dm|send|email) (?:me|us) (?:your|a) (?:portfolio|resume|application|proposal|quote))\b/i
const contract = /\b(?:freelance(?:r|rs)?|independent contractors?|contractors?|contract[- ]to[- ]hire|paid (?:project|gig|commission)|(?:\d+[- ](?:week|month)s?|remote|short[- ]term|fixed[- ]term) contract|contract (?:role|work|position|project|designer|developer|illustrator|engineer)|on (?:a )?contract basis|fixed[- ]price (?:job|project))\b/i
const staleOrSelling = /\b(?:repost(?:ing)?|reshar(?:e|ing)|signal boost|boosting|still open from|open to work|hire me|for hire|my commissions are open|(?:i(?:'m| am)|we(?:'re| are)) (?:available|looking for (?:work|clients|a job)|seeking (?:work|clients|employment))|(?:commission|equity)[- ]only|if (?:we|our project) (?:get|gets|secure|secures) funding|subject to (?:successful )?(?:crowdfunding|funding)|volunteer(?:s|ing)?)\b/i

export async function searchMastodonJobs(since: Date) {
  const response = await remote(endpoint, { cache:'force-cache', next:{revalidate:30}, headers:{ 'User-Agent':'LeadToClient/1.0 (public hiring posts; https://leadtoclient.app)' } })
  const rows = z.array(z.unknown()).max(40).parse(JSON.parse(await bodyText(response, 2_000_000)))
  const now = Date.now()
  const candidates = new Map<string, {url:string; posted_at:string}>()
  const posts = new Map<string, PaidProjectPost>()
  let oldest = Infinity
  for (const value of rows) {
    if (value && typeof value === 'object' && 'created_at' in value && typeof value.created_at === 'string') {
      const time = Date.parse(value.created_at)
      if (Number.isFinite(time)) oldest = Math.min(oldest, time)
    }
    const parsed = status.safeParse(value)
    if (!parsed.success) continue
    const row = parsed.data
    const time = Date.parse(row.created_at)
    if (time < since.getTime() || time > now || !row.tags.some(t => tags.includes(t.name.toLowerCase()))) continue
    if (/<blockquote\b|class\s*=\s*["'][^"']*\bquote-inline\b/i.test(row.content)) continue
    const url = originalStatus(row)
    if (!url) continue
    const posted_at = new Date(time).toISOString()
    candidates.set(url, {url,posted_at})
    const body = authorText(row.content)
    const text = body.replace(/[’‘]/g,"'")
    if (!contract.test(text) || !employer.test(text) || staleOrSelling.test(text) || closedRequest(text)) continue
    const pay = advertisedPay(text)
    if (!pay) continue
    posts.set(url, { source:'mastodon', engagement:'paid_freelance', title:body.slice(0,180), body:body.slice(0,2000), url, posted_at, author:'', ...pay })
  }
  const reset = Date.parse(response.headers.get('x-ratelimit-reset') ?? '')
  const exhausted = response.headers.get('x-ratelimit-remaining') === '0'
  return {
    posts: [...posts.values()].sort((a, b) => b.posted_at.localeCompare(a.posted_at)),
    candidates: [...candidates.values()],
    partial: rows.length === 40 && oldest > since.getTime(),
    retryAt: exhausted ? new Date(Number.isFinite(reset) && reset > now ? reset : now + 60_000) : undefined,
  }
}
