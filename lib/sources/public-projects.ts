import { z } from 'zod'
import type { PaidProjectPost } from '../research-catalog'
import { apiURL, bodyText, plain, ProviderBackoff } from './shared'

const feed = apiURL('https://api.github.com/search/issues', {
  q: 'is:issue is:open no:assignee (bounty in:title OR label:bounty OR label:paid)',
  advanced_search: 'true', sort: 'created', order: 'desc', per_page: '75',
})
const pageSchema = z.object({
  total_count: z.number().int().nonnegative(), incomplete_results: z.boolean(), items: z.array(z.unknown()),
})
const timestampSchema = z.object({ created_at: z.iso.datetime({ offset: true }) })
const publicIssue = timestampSchema.extend({
  html_url: z.string(), number: z.number().int().positive(), state: z.literal('open'),
  closed_at: z.null(), pull_request: z.never().optional(),
})
const issueSchema = publicIssue.extend({
  title: z.string().min(1), body: z.string().nullable(),
  author_association: z.enum(['OWNER', 'MEMBER', 'COLLABORATOR']),
  locked: z.literal(false),
  assignees: z.array(z.unknown()).max(0), assignee: z.null().optional(),
  labels: z.array(z.object({ name: z.string() })),
})
const unavailable = /\b(?:unpaid|volunteer only|unfunded|no (?:cash |monetary )?(?:bounty|reward|payment)|(?:bounty|reward|payment) (?:has been |is |already )?(?:paid out|claimed|cancelled|canceled|withdrawn)|bounty (?:program|alert|roundup)|(?:bug|security|vulnerability) bount(?:y|ies)|responsible disclosure)\b/i
const taken = /^(?:assigned|claimed|completed|paid out|cancelled|in progress|in-progress|bounty claimed)$/i
const promotional = /\b(?:bounty digest|bounty watchlist|bounty opportunities|bounty newsletter|example bounty|test bounty|referral (?:reward|bonus)|airdrop|giveaway|rewards? for (?:signing up|referrals)|(?:follow|retweet) (?:us|me) (?:on|to))\b/i
const deliverable = /\b(?:fix|build|create|implement|add|write|port|update|repair|improve|convert|migrate|design|translate|remove|reproduce|refactor|integrate|document|test|debug|investigate|resolve|support for|regression test|accepted (?:pr|pull request)|acceptance criteria|deliverables?)\b/i
const numericAmount = String.raw`[1-9]\d*(?:,\d{3})*(?:\.\d{1,2})?`
const currency = '(?:USD|CAD|AUD|GBP|EUR|CHF|INR|JPY)'
const amount = `(?:[$£€₹]\\s*${numericAmount}(?:\\s*${currency}\\b)?|\\b${currency}\\s*${numericAmount}|${numericAmount}\\s*${currency}\\b)`
const namedOffer = new RegExp(`^(?:[\\s[(/\\]🏆💎💰:-]*)(?:cash |paid )?(?:bounty|reward|compensation|payment)(?: amount)?(?:\\s+of)?[\\s:–—=-]*(${amount})(?![\\d.,])`, 'iu')
const leadingAmount = new RegExp(`^[\\s[(]*(${amount})\\s+(?:cash )?(?:bounty|reward)\\b`, 'iu')
const promised = new RegExp(`\\b(?:we|i)(?:['’]ll| will| offer(?:s)?(?: to pay)?| can pay)(?: pay| offer)?\\s+(${amount})(?![\\d.,])\\s+(?:for|to|upon|on|when)\\b`, 'iu')

function offerLine(title: string, body: string) {
  // Ignore attributed quotes, sample code, and markdown links to third-party bounties.
  const authored = body.replace(/<!--[^]*?-->|(?:```|~~~)[^]*?(?:```|~~~)/g, '')
  const lines = [title, ...authored.split(/\r?\n/)].filter(line => !/^\s*>/.test(line) && !/\]\(https?:\/\//i.test(line))
  for (const line of lines) {
    const text = plain(line).replace(/^[\s#*-]+/, '').replace(/\*\*|__/g, '')
    const offer = namedOffer.exec(text) || leadingAmount.exec(text) || promised.exec(text)
    if (offer) return offer[1].trim()
  }
}

function publicCandidate(row: unknown, since: Date) {
  const parsed = publicIssue.safeParse(row)
  if (!parsed.success) return
  const issue = parsed.data
  const time = Date.parse(issue.created_at)
  if (time < since.getTime() || time > Date.now()) return
  const path = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/([1-9]\d*)$/.exec(issue.html_url)
  if (!path || Number(path[3]) !== issue.number || [path[1], path[2]].some(part => part === '.' || part === '..')) return
  return { url: issue.html_url, posted_at: new Date(time).toISOString(), repository: path[1] + '/' + path[2] }
}

function paidIssue(source: 'github', row: unknown, candidate: NonNullable<ReturnType<typeof publicCandidate>>): PaidProjectPost | undefined {
  const parsed = issueSchema.safeParse(row)
  if (!parsed.success) return
  const issue = parsed.data
  const labels = issue.labels.map(label => label.name)
  const body = issue.body ?? ''
  const text = issue.title + '\n' + body
  if (labels.some(label => taken.test(label)) || unavailable.test(text + '\n' + labels.join(' ')) ||
      promotional.test(text) || !deliverable.test(text)) return
  const compensation = offerLine(issue.title, body)
  if (!compensation) return
  return {
    source, engagement: 'paid_freelance', title: plain(issue.title).slice(0, 350), url: candidate.url,
    body: plain(body).replace(/[\w.+-]+@[\w.-]+\.[\w-]+/g, '').slice(0, 4500),
    author: candidate.repository, posted_at: candidate.posted_at,
    tags: labels, compensation,
  }
}

function retryTime(headers: Headers) {
  const resetAt = Number(headers.get('x-ratelimit-reset')) * 1000
  const retry = headers.get('retry-after') ?? ''
  const retryAt = /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)
  return new Date(Math.max(Date.now() + 1000, Number.isFinite(retryAt) ? retryAt : Date.now() + 60_000,
    headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(resetAt) ? resetAt : 0))
}

// All users share a single feed request. The common matcher applies their individual query.
export async function searchPublicProjects(source: 'github', since: Date) {
  const response = await fetch(feed, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LeadToClient/1.0 (+https://leadtoclient.app)', 'X-GitHub-Api-Version': '2022-11-28' },
    next: { revalidate: 60 }, cache: 'force-cache', redirect: 'error', signal: AbortSignal.timeout(8000),
  })
  const exhausted = response.headers.get('x-ratelimit-remaining') === '0'
  if (response.status === 429 || response.status === 503 ||
      (response.status === 403 && (exhausted || response.headers.has('retry-after') || /rate limit/i.test(await bodyText(response, 32_768))))) {
    throw new ProviderBackoff(retryTime(response.headers))
  }
  if (!response.ok) throw new Error('Source returned HTTP ' + response.status)
  const data = pageSchema.parse(JSON.parse(await bodyText(response, 2_500_000)))
  const posts = new Map<string, PaidProjectPost>()
  const candidates = new Map<string, { url: string; posted_at: string }>()
  let reachedCutoff = false
  for (const row of data.items.slice(0, 75)) {
    const created = timestampSchema.safeParse(row)
    if (created.success && Date.parse(created.data.created_at) <= since.getTime()) reachedCutoff = true
    const candidate = publicCandidate(row, since)
    if (!candidate) continue
    candidates.set(candidate.url, { url: candidate.url, posted_at: candidate.posted_at })
    const post = paidIssue(source, row, candidate)
    if (post) posts.set(post.url, post)
  }
  return { posts: [...posts.values()], candidates: [...candidates.values()],
    partial: data.incomplete_results || (data.total_count > Math.min(75, data.items.length) && !reachedCutoff),
    retryAt: exhausted ? retryTime(response.headers) : undefined }
}
