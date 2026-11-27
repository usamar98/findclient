import { z } from 'zod'
import { closedRequest } from '../lead-intelligence'
import type { CandidateTime, PaidProjectPost, UnpricedContract } from '../research-catalog'
import { advertisedPay, unpaid } from './contract-boards'
import { bodyText, plain, ProviderBackoff, remote } from './shared'

type Board = 'jobicy' | 'jobtech'
type BoardJob = Pick<PaidProjectPost, 'source' | 'url' | 'title' | 'body' | 'author' | 'tags' | 'posted_at'>

const providerHeaders = { 'User-Agent': 'LeadToClient/1.0 (+https://leadtoclient.app)', Accept: 'application/json' }
const instant = z.iso.datetime({ offset: true })
const jobicyPage = z.object({
  jobs: z.array(z.unknown()), success: z.literal(true), nextCursor: z.string().nullable(),
})
const jobicyJob = z.object({
  url: z.string(), pubDate: instant, jobTitle: z.string(), companyName: z.string(),
  jobDescription: z.string(), jobType: z.array(z.string()), jobIndustry: z.array(z.string()).optional(),
  salaryMin: z.number().nullish(), salaryMax: z.number().nullish(),
  salaryCurrency: z.string().nullish(), salaryPeriod: z.string().nullish(),
})
const searchPage = z.object({ total: z.object({ value: z.number().int().nonnegative() }), hits: z.array(z.unknown()) })
const jobtechJob = z.object({
  id: z.string().regex(/^\d+$/), headline: z.string(), employer: z.object({name: z.string()}),
  publication_date: z.string(), timestamp: z.number().nullish(), removed: z.boolean(),
  description: z.object({text: z.string()}), occupation: z.object({label: z.string()}).nullish(),
  employment_type: z.object({label: z.string()}).nullish(), last_publication_date: z.string().nullish(),
  must_have: z.object({ skills: z.array(z.object({label: z.string()})).nullish() }).nullish(),
})
const swedishTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

// JobSearch returns publication_date as a Swedish wall-clock time. During the
// repeated autumn hour accept it only if the accompanying event time disambiguates it.
function stockholmInstant(raw: string, eventTime?: number | null) {
  if (instant.safeParse(raw).success) return Date.parse(raw)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(raw)) return NaN
  const wall = Date.parse(raw + 'Z')
  if (!Number.isFinite(wall)) return NaN
  const possibilities = [wall - 3_600_000, wall - 7_200_000].filter(time =>
    swedishTime.format(time).replace(' ', 'T') === raw)
  if (possibilities.length === 1) return possibilities[0]
  return possibilities.find(time => eventTime != null && Math.floor(eventTime / 1000) === time / 1000) ?? NaN
}

function jobicyUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (url.origin === 'https://jobicy.com' && !url.username && !url.password && /^\/jobs\/[\w%-]+\/?$/.test(url.pathname))
      return url.origin + url.pathname
  } catch { /* Discard unrecognized listing links. */ }
}

const explicitContract = /\b(?:freelanc(?:e|er)|independent contractor|frilans\w*|underkonsult\w*)\b/i
const contractDescription = /\b(?:as an? (?:freelancer|independent contractor)|(?:this is|employment type\s*:)\s+(?:an? )?(?:contract|freelance)\b|(?:arbeta som (?:anställd eller )?|hyras ut som |för dig som |söker (?:en |dig som )?)(?:frilans\w*|underkonsult\w*)|(?:uppdraget|rollen) (?:är|passar) för (?:dig som är )?(?:egenföretagare|frilans\w*|underkonsult\w*))\b/i
const acceptsIndependent = /\bvi (?:välkomnar (?:även )?|samarbetar (?:även )?med )underkonsulter och frilansare med eget bolag\b/i
const noCompensation = /\b(?:uncompensated|unremunerated|ideellt|obetalt?|oavlönad\w*)\b|\b(?:pay|salary|rate|budget)\s*:\s*[$£€]?\s*0(?:[.,]00)?(?:\s|$)|(?<![\d.,])\b0(?:[.,]00)?\s*(?:SEK|kr)\s*(?:\/|per)\s*(?:timme|tim|hour|dag|day|uppdrag)\b/i

// English search terms for explicit Swedish job titles and occupation labels.
const swedishRoles: [RegExp, string[]][] = [
  [/\b(?:(?:mjukvaru|programvaru|system)[ -]?utvecklare|mjukvaruingenjör|programmerare)\b/i, ['software developer']],
  [/\bwebb[ -]?utvecklare\b/i, ['web developer']],
  [/\bfull[ -]?stack[ -]?utvecklare\b/i, ['full stack developer']],
  [/\bfront[ -]?end[ -]?utvecklare\b/i, ['frontend developer']],
  [/\bback[ -]?end[ -]?utvecklare\b/i, ['backend developer']],
  [/\bshopify[ -]?utvecklare\b/i, ['Shopify developer', 'web developer']],
  [/\bwebb[ -]?(?:designer|formgivare)\b/i, ['web designer']],
  [/\bgrafisk (?:designer|formgivare)\b/i, ['graphic designer']],
  [/\bformgivare\b/i, ['designer']],
]

export async function searchOpenJobBoard(source: Board, since: Date) {
  const now = Date.now()
  const candidates = new Map<string, CandidateTime>()
  const posts = new Map<string, PaidProjectPost>()
  const unpricedContracts = new Map<string, UnpricedContract>()
  let partial = false
  let retryAt: Date | undefined
  function inWindow(time: number) { return time >= since.getTime() && time <= now }

  function add(job: BoardJob, salary?: string, positiveSalary = false) {
    if (!job.title || !job.author) return
    const text = job.title + ' ' + job.body
    if (unpaid.test(text) || noCompensation.test(text) || closedRequest(text)) return
    const pay = advertisedPay(text, positiveSalary)
    const details = { ...job, title: job.title.slice(0, 350), body: job.body.slice(0, 4500), author: job.author.slice(0, 120) }
    if (pay) posts.set(job.url, { ...details, engagement: 'paid_freelance', compensation: salary ?? pay.compensation })
    else unpricedContracts.set(job.url, { ...details, engagement: 'contract_pay_unlisted' })
  }

  if (source === 'jobicy') {
    // All requests share these pages, independently of keyword and time-window filters.
    // Jobicy asks for hourly-or-less synchronization and serves delayed postings.
    const url = new URL('https://jobicy.com/api/jobs?count=50')
    const cursors = new Set<string>()
    const deadline = performance.now() + 8000
    const pageLimit = 12
    for (let page = 0; page < pageLimit; page++) {
      let data: z.infer<typeof jobicyPage>
      try {
        const timeLeft = Math.ceil(deadline - performance.now())
        if (timeLeft <= 0) { partial = true; break }
        const response = await remote(url, { headers: providerHeaders, cache: 'force-cache', next: { revalidate: 3600 },
          signal: AbortSignal.timeout(timeLeft) })
        data = jobicyPage.parse(JSON.parse(await bodyText(response, 2_000_000)))
      } catch (error) {
        if (page === 0) throw error
        if (error instanceof ProviderBackoff) retryAt = error.retryAt
        partial = true
        break
      }
      let oldest = Infinity
      for (const row of data.jobs) {
        const result = jobicyJob.safeParse(row)
        if (!result.success) { partial = true; continue }
        const job = result.data
        const time = Date.parse(job.pubDate)
        oldest = Math.min(oldest, time)
        const link = jobicyUrl(job.url)
        if (!link || !inWindow(time)) continue
        const posted_at = new Date(time).toISOString()
        candidates.set(link, { url: link, posted_at })
        if (!job.jobType.some(type => /^(?:freelance|contract|contractor)$/i.test(type.trim()))) continue
        const minimum = job.salaryMin ?? 0, maximum = job.salaryMax ?? 0
        const hasPay = minimum > 0 || maximum > 0
        const amount = minimum > 0 && maximum > minimum ? minimum + '–' + maximum : minimum || maximum
        const bound = minimum <= 0 ? 'Up to ' : maximum <= 0 ? 'From ' : ''
        const salary = hasPay && job.salaryCurrency && job.salaryPeriod ?
          bound + job.salaryCurrency + ' ' + amount + ' ' + job.salaryPeriod : undefined
        add({ source, title: plain(job.jobTitle), body: plain(job.jobDescription), author: plain(job.companyName),
          tags: job.jobIndustry?.map(plain), url: link, posted_at }, salary, hasPay)
      }
      if (!data.nextCursor || oldest < since.getTime()) break
      if (page + 1 === pageLimit || cursors.has(data.nextCursor)) { partial = true; break }
      cursors.add(data.nextCursor)
      url.searchParams.set('cursor', data.nextCursor)
    }
  } else {
    const url = new URL('https://jobsearch.api.jobtechdev.se/search')
    url.search = new URLSearchParams({ q: 'freelance freelancer frilans frilansare frilansande underkonsult underkonsulter contractor',
      sort: 'pubdate-desc', limit: '100' }).toString()
    const response = await remote(url, { cache: 'force-cache', next: { revalidate: 60 }, headers: {
      ...providerHeaders, 'x-feature-disable-smart-freetext': 'true', 'x-feature-freetext-bool-method': 'or',
      'X-Fields': 'total{value},hits{id,headline,description{text},employer{name},publication_date,last_publication_date,timestamp,removed,employment_type{label},occupation{label},must_have{skills{label}}}',
    } })
    const data = searchPage.parse(JSON.parse(await bodyText(response, 2_000_000)))
    let oldest = Infinity
    for (const row of data.hits) {
      const result = jobtechJob.safeParse(row)
      if (!result.success) { partial = true; continue }
      const job = result.data
      const time = stockholmInstant(job.publication_date, job.timestamp)
      if (!Number.isFinite(time)) { partial = true; continue }
      oldest = Math.min(oldest, time)
      if (job.removed || !inWindow(time)) continue
      if (job.last_publication_date && !(stockholmInstant(job.last_publication_date) > now)) continue
      const link = 'https://arbetsformedlingen.se/platsbanken/annonser/' + job.id
      const posted_at = new Date(time).toISOString()
      candidates.set(link, { url: link, posted_at })
      const title = plain(job.headline), body = plain(job.description.text)
      if (!explicitContract.test(title) && !explicitContract.test(job.employment_type?.label ?? '') && !contractDescription.test(body) && !acceptsIndependent.test(body)) continue
      const sek = /\b[1-9][\d ]*(?:[.,]\d+)?\s*(?:SEK|kr)\s*(?:\/|per)\s*(?:timme|tim|hour|dag|day|uppdrag)\b/i.exec(body)?.[0]
      const tags = new Set((job.must_have?.skills ?? []).map(skill => plain(skill.label)))
      const occupation = plain(job.occupation?.label ?? '')
      if (occupation) tags.add(occupation)
      // These headlines can name a role the manager supervises or the teacher trains.
      const roleTitle = /\b(?:chef|rekryterare|lärare|projektledare|säljare)\b/i.test(title) ? '' : title
      for (const [pattern, aliases] of swedishRoles) {
        if (pattern.test(occupation) || pattern.test(roleTitle)) aliases.forEach(alias => tags.add(alias))
      }
      add({ source, title, body, author: plain(job.employer.name), tags: [...tags], url: link, posted_at }, sek, Boolean(sek))
    }
    partial ||= data.total.value > data.hits.length && oldest >= since.getTime()
  }
  return { posts: [...posts.values()], unpricedContracts: [...unpricedContracts.values()], candidates: [...candidates.values()], partial, retryAt }
}
