import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'
import { closedRequest } from '../lead-intelligence'
import type { PaidProjectPost, UnpricedContract } from '../research-catalog'
import { bodyText, plain, remote } from './shared'

type Board = 'weworkremotely' | 'remoteok'
const feeds = {
  // The We Work Remotely publisher sets <ttl>60</ttl> in minutes.
  weworkremotely: { url: 'https://weworkremotely.com/remote-jobs.rss', revalidate: 3600 },
  remoteok: { url: 'https://remoteok.com/api', revalidate: 60 },
} as const
const rssInstant = z.string().regex(/\d{2}:\d{2}:\d{2}\s+(?:[+-]\d{4}|GMT|UTC)$/i)
const rssItem = z.object({
  link: z.string(), title: z.string(), description: z.string(), type: z.string(),
  pubDate: rssInstant, expires_at: rssInstant.optional(), skills: z.string().optional(),
})
const remoteJob = z.object({
  id: z.string().regex(/^\d+$/), url: z.string(), position: z.string(), company: z.string(), description: z.string(),
  date: z.iso.datetime({offset: true}), epoch: z.number().int().positive(), tags: z.array(z.string()).optional(),
  salary_min: z.number().nonnegative().optional(), salary_max: z.number().nonnegative().optional(),
  closed: z.boolean().optional(), expired: z.boolean().optional(),
})
const rssChannel = z.object({ rss: z.object({ channel: z.object({ title: z.string(), item: z.array(z.unknown()).default([]) }) }) })
const xml = new XMLParser({ parseTagValue: false, processEntities: false, isArray: (_name, path) => path === 'rss.channel.item' })

export const unpaid = /\b(?:unpaid(?! (?:leave|time off))|pro[- ]bono|(?:commission|equity|exposure|experience)[- ]only|volunteer(?:ing)? (?:job|role|opportunity|position)|no (?:compensation|pay(?:ment)?|budget)|without (?:pay|compensation)|pay to apply|pay an? (?:application|registration) fee)\b/i
const zeroPay = /\b(?:uncompensated|unremunerated|volunteers? wanted|work for free|voluntary (?:position|role))\b|\b(?:pay|rate|salary|compensation|budget)\s*(?:is|of|:)?\s*[$£€]?\s*0\b/i
const selfPromotion = /\[for hire\]|^(?:for hire\b|.{1,75}[-|:]\s*for hire\b)|\b(?:hire me|available for hire|open to work)\b/i
const seekingWork = /\b(?:i(?:'m| am)|we(?:'re| are)) (?:looking for|seeking) (?:work|clients|(?:my next |an? )?(?:(?!(?:who|for|join|to|this|and|with)\b)[\p{L}.+#-]+ ){0,4}(?:jobs?|gigs?|positions?|roles?))\b/iu
const noOffer = /\b(?:wish (?:we|i) could hire|(?:i|we) (?:hope to hire|would hire if)|(?:not|never) (?:currently )?(?:hiring|seeking contractors)|no (?:contractors|freelancers) (?:please|accepted)|(?:role|position) (?:is )?permanent only)\b/i
export function excludedContract(text: string) {
  const words = text.replace(/[’‘]/g, "'")
  return unpaid.test(words) || zeroPay.test(words) || selfPromotion.test(words) || seekingWork.test(words) ||
    noOffer.test(words) || closedRequest(words)
}
const explicitPay = /\b(?:paid (?:freelance|contract|project|engagement|gig|position|role)|(?:hourly|daily|project) rate (?:of|from|is|based on|negotiable)|(?:share|include|submit|specify) your (?:hourly|daily|project) rate)\b/i
const payAmount = /(?:\b(?:pay|rate|salary|compensation|budget|fixed fee|earnings)\b[^.!?]{0,60}(?:[$£€₹]|\b(?:USD|EUR|GBP|CAD|AUD|INR)\s*)\s*[1-9]\d*|(?:[$£€₹]|\b(?:USD|EUR|GBP|CAD|AUD|INR)\s*)\s*[1-9][\d,.]*(?:\s*(?:[-–—]|to)\s*[$£€₹]?\s*\d[\d,.]*)?\s*(?:(?:USD|EUR|GBP|CAD|AUD|INR)\s*)?(?:\/\s*(?:per\s+)?|per\s+|an?\s+)(?:hour|hr|day|week|month|year|project|word)\b)/i
const quotedRate = /(?:[$£€₹]|\b(?:USD|EUR|GBP|CAD|AUD|INR)\s*)\s*[1-9]\d*(?:[.,]\d+)*(?:k\b)?(?:\s*(?:[-–—]|to)\s*(?:[$£€₹]|USD|EUR|GBP|CAD|AUD|INR)?\s*\d+(?:[.,]\d+)*(?:k\b)?)?(?:\s+(?:USD|EUR|GBP|CAD|AUD|INR)\b)?(?:\s*(?:\/\s*(?:per\s+)?|per\s+|an?\s+)(?:hour|hr|day|week|month|year|project|word)\b)?/i
const trailingCurrencyRate = /\b[1-9]\d*(?:[.,]\d+)*(?:\s*(?:[-–—]|to)\s*\d+(?:[.,]\d+)*)?\s+(?:USD|EUR|GBP|CAD|AUD|INR)\s*(?:\/\s*|per\s+)(?:hour|hr|day|week|month|year|project|word)\b/i

export function advertisedPay(text: string, numericPay = false): {compensation?: string} | null {
  if (unpaid.test(text)) return null
  const pay = payAmount.exec(text)
  const compensation = (pay && quotedRate.exec(text.slice(pay.index, pay.index + pay[0].length + 65))?.[0]) || trailingCurrencyRate.exec(text)?.[0]
  if (compensation) return { compensation }
  return numericPay || explicitPay.test(text) ? {} : null
}

function hiringTerms(title: string, body: string, tags: string[]) {
  const managesContractors = /\b(?:freelance(?:r)?|contractor) (?:compliance|relations|operations|management|payroll|community manager)\b/i.test(title)
  const contractTitle = /\b(?:freelanc(?:e|er)|contractor|contract[- ]to[- ]hire|contract (?:role|position|opportunity))\b|[([]\s*contract\s*[)\]/]|(?:\s[-–—|]\s*|,\s*)contract\s*$/i.test(title)
  const namedContractRole = /^(?:(?:senior|junior|lead|staff)\s+)?contract (?:(?:senior|lead|software|web|mobile|shopify|full[- ]stack|front[- ]end|back[- ]end|graphic|data|ux|ui|technical) ){0,2}(?:developer|engineer|designer|recruiter|copywriter|analyst|consultant)\b/i.test(title)
  return (!managesContractors && (contractTitle || namedContractRole)) ||
    tags.some(tag => /^(?:contract|contractor|freelance)$/i.test(tag)) ||
    /\b(?:this (?:is|will be) (?:an? )?(?:[\d-]+[- ]months? )?(?:contract|freelance|independent contractor) (?:role|position|engagement|opportunity)|(?:employment|engagement|job) type\s*:\s*(?:contract|freelance)|(?:hiring|seeking) (?:an? )?(?:freelance|independent contractor))\b/i.test(body)
}

function permalink(raw: string, board: Board, id?: string) {
  const host = board === 'remoteok' ? 'remoteok.com' : 'weworkremotely.com'
  try {
    const url = new URL(raw)
    if (url.origin !== 'https://' + host || url.username || url.password || !/^\/remote-jobs\/[\w%-]+\/?$/.test(url.pathname)) return
    if (id && !url.pathname.replace(/\/$/, '').endsWith('-' + id)) return
    return url.origin + url.pathname
  } catch { return }
}

export async function searchContractBoard(source: Board, since: Date) {
  const feed = feeds[source]
  const response = await remote(feed.url, { cache: 'force-cache', next: { revalidate: feed.revalidate }, headers: {
    'User-Agent': 'LeadToClient/1.0 (public job feeds; https://leadtoclient.app)',
  } })
  const text = await bodyText(response, 3_000_000)
  const now = Date.now()
  const posts = new Map<string, PaidProjectPost>()
  const unpricedContracts = new Map<string, UnpricedContract>()
  const candidates = new Map<string, {url:string; posted_at:string}>()
  function addListing(title: string, body: string, url: string, author: string, time: number, tags: string[], numericPay = false) {
    if (!title) return
    const text = title + ' ' + body
    if (excludedContract(text)) return
    const pay = advertisedPay(text, numericPay)
    const details = { source, title: title.slice(0, 350), body: body.slice(0, 4500), url, author: author.slice(0, 120), tags, posted_at: new Date(time).toISOString() }
    if (pay) {
      posts.set(url, { ...details, engagement: 'paid_freelance', ...pay })
    } else if (author) {
      unpricedContracts.set(url, { ...details, engagement: 'contract_pay_unlisted' })
    }
  }
  let total = 0, oldest = Infinity
  let invalid = false
  function inWindow(time: number) {
    if (!Number.isFinite(time)) return false
    total++
    oldest = Math.min(oldest, time)
    return time >= since.getTime() && time <= now
  }
  if (source === 'weworkremotely') {
    if (/<!DOCTYPE/i.test(text)) throw new Error('Invalid job feed.')
    const rows = rssChannel.parse(xml.parse(text)).rss.channel.item
    for (const row of rows) {
      const result = rssItem.safeParse(row)
      if (!result.success) { invalid = true; continue }
      const job = result.data
      const time = Date.parse(job.pubDate)
      if (!inWindow(time) || (job.expires_at && !(Date.parse(job.expires_at) > now))) continue
      const url = permalink(job.link, source)
      if (!url) continue
      candidates.set(url, { url, posted_at: new Date(time).toISOString() })
      const title = plain(job.title)
      const colon = title.indexOf(': ')
      const company = colon > 0 ? title.slice(0, colon) : ''
      const role = colon > 0 ? title.slice(colon + 2) : title
      const body = plain(job.description)
      // An employer can advertise a full-time-hours contract in the Full-Time feed.
      if (!/^(contract|freelance)$/i.test(job.type.trim()) && !hiringTerms(role, body, [])) continue
      addListing(role, body, url, company, time, (job.skills ?? '').split(',').map(tag => tag.trim()).filter(Boolean))
    }
  } else {
    const rows = z.array(z.unknown()).parse(JSON.parse(text))
    for (const row of rows) {
      if (row && typeof row === 'object' && 'legal' in row && !('id' in row)) continue
      const result = remoteJob.safeParse(row)
      if (!result.success) { invalid = true; continue }
      const job = result.data
      const time = Date.parse(job.date)
      if (time !== job.epoch * 1000 || !inWindow(time) || job.closed || job.expired) continue
      const url = permalink(job.url, source, job.id)
      if (!url) continue
      candidates.set(url, { url, posted_at: new Date(time).toISOString() })
      const title = plain(job.position)
      const body = plain(job.description.replace(/\\[nr]/g, ' '))
      const tags = job.tags ?? []
      if (!hiringTerms(title, body, tags)) continue
      const pay = (job.salary_min ?? 0) > 0 || (job.salary_max ?? 0) > 0
      addListing(title, body, url, plain(job.company), time, tags, pay)
    }
  }
  // Both publishers expose bounded latest listings. A full page that stops
  // inside the selected window may have additional listings outside the page.
  return {
    posts: [...posts.values()].sort((a, b) => b.posted_at.localeCompare(a.posted_at)),
    ...(unpricedContracts.size > 0 && { unpricedContracts: [...unpricedContracts.values()] }),
    candidates: [...candidates.values()],
    partial: invalid || (total >= 100 && oldest > since.getTime()),
  }
}
