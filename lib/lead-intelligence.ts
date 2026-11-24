import { z } from 'zod'
import { posterWebsite } from './site-audit/target'

export const requestTypes = ['hiring', 'advice', 'offering', 'unclear'] as const
export const requestLabels = {
  hiring: 'Seeking a contractor',
  advice: 'Asking for advice',
  offering: 'Offering services',
  unclear: 'Hiring intent unclear',
}
export const feedbackLabels = {
  good_fit: 'Good fit',
  wrong_service: 'Wrong service',
  diy: 'Wants DIY advice',
  seller: 'Selling a service',
}
const signalKeys = ['request', 'budget', 'urgency', 'business'] as const
const quote = z.string().max(300)
export const evidenceFields = z.object({
  request: quote,
  budget: quote,
  urgency: quote,
  business: quote,
})
export const availabilitySchema = z.object({
  state: z.enum(['visible', 'closed', 'unknown']),
  checked_at: z.string(),
})
export const buyerSchema = z.object({
  request_type: z.enum(requestTypes),
  evidence: evidenceFields,
  account_created_at: z.string().nullable(),
  site: z.string().nullable(),
  site_source: z.enum(['post', 'profile']).optional(),
  quality_score: z.number().int().min(0).max(100).nullable(),
  availability: availabilitySchema,
})
export type Availability = z.infer<typeof availabilitySchema>
export type BuyerIntelligence = z.infer<typeof buyerSchema>
type Reading = {
  request_type: BuyerIntelligence['request_type']
  evidence: z.infer<typeof evidenceFields>
}
type SourceText = {
  title: string
  body: string
  url: string
  posted_at: string
}

export function closedRequest(text: string) {
  return /\b(?:no longer (?:hiring|accepting (?:applications|proposals)|looking (?:for (?:a |an )?(?:developer|designer|freelancer|contractor)|to hire))|(?:position|role) (?:has been |is )?filled|(?:applications|project) (?:are |is |now )?closed|(?:we|i)(?:'ve| have) hired someone|enough (?:applications|responses) received|closing this (?:post|request))\b/i.test(
    text,
  )
}
const patterns = {
  hiring:
    /\b(?:looking to hire|looking for (?:an? |a freelance |an experienced )?(?:freelanc\w*|developer|designer|contractor|consultant|agency)|need(?:ing)? (?:an? )?(?:freelancer|contractor)|seeking (?:an? )?(?:freelancer|contractor)|(?:send|share) (?:me |us )?(?:a |your )?(?:quote|rates)|paid (?:project|opportunity))\b/i,
  offering:
    /\b(?:i(?:'m| am) (?:a freelancer|available for hire)|seeking work|my services|hire me)\b/i,
  advice:
    /\b(?:how (?:can|do|should) (?:i|we)|any (?:tips|advice)|can (?:someone|anyone) explain)\b/i,
  budget:
    /(?:[$£€]\s?\d|\b(?:our |my )?budget (?:is|of)|\bpaid (?:project|opportunity)|\b(?:send|share) (?:me |us )?(?:a |your )?(?:quote|rates))/i,
  urgency:
    /\b(?:deadline|urgent(?:ly)?|asap|by (?:monday|tuesday|wednesday|thursday|friday|tomorrow)|before (?:launch|friday)|this week)\b/i,
  business:
    /\b(?:my|our|we run (?:a|an)|i run (?:a|an)) (?:shopify |online )?(?:business|store|agency|company|startup|shop)\b/i,
}
export function assessBuyer(
  post: SourceText,
  reading?: Reading,
  accountCreated: string | null = null,
  availability?: Availability,
  profileSite: string | null = null,
): BuyerIntelligence {
  const parts = [post.title, ...post.body.split(/(?<=[.!?])\s+|\n+/)].filter(
    Boolean,
  )
  const sample = (pattern: RegExp) => {
    for (const part of parts) {
      const match = pattern.exec(part)
      if (match) {
        const start = Math.max(0, match.index - 65)
        return part.slice(start, start + 240).trim()
      }
    }
    return ''
  }
  const text = post.title + '\n' + post.body
  const type = patterns.offering.test(text)
    ? 'offering'
    : patterns.hiring.test(text)
      ? 'hiring'
      : patterns.advice.test(text)
        ? 'advice'
        : 'unclear'
  const evidence = {
    request: type === 'unclear' ? '' : sample(patterns[type]),
    budget: sample(patterns.budget),
    urgency: sample(patterns.urgency),
    business: sample(patterns.business),
  }
  let requestType: BuyerIntelligence['request_type'] = type
  if (reading) {
    for (const key of signalKeys) {
      const value = reading.evidence[key].trim()
      if (
        value.length >= 4 &&
        (post.body.includes(value) || post.title.includes(value))
      ) {
        evidence[key] = value
        if (key === 'request') requestType = reading.request_type
      }
    }
  }
  const posted = Date.parse(post.posted_at)
  const created = accountCreated ? Date.parse(accountCreated) : NaN
  const accountDate =
    Number.isFinite(created) && created <= posted
      ? new Date(created).toISOString()
      : null
  const postSite = posterWebsite(post.title, post.body, post.url)
  const site = postSite ?? profileSite
  const accountPoints = accountDate
    ? Math.min(
        10,
        Math.max(1, Math.floor((posted - created) / (30 * 86400000))),
      )
    : 0
  const unpaid =
    /\b(?:unpaid|no budget|(?:budget|pay) (?:is |of )?(?:zero|\$0\b)|can't (?:pay|afford)|cannot (?:pay|afford)|volunteers? only|free help only)\b/i.test(
      text,
    )
  if (unpaid && !evidence.budget)
    evidence.budget = sample(
      /\b(?:unpaid|no budget|cannot pay|volunteers? only)\b/i,
    )
  const score =
    (requestType === 'hiring' ? 30 : 0) +
    (evidence.budget && !unpaid ? 25 : 0) +
    (evidence.business || site ? 20 : 0) +
    (evidence.urgency ? 15 : 0) +
    accountPoints
  const lastCheck: Availability = availability ?? {
    state: 'unknown',
    checked_at: new Date().toISOString(),
  }
  return {
    request_type: requestType,
    evidence,
    account_created_at: accountDate,
    site,
    site_source: site ? (postSite ? 'post' : 'profile') : undefined,
    availability: closedRequest(text)
      ? { ...lastCheck, state: 'closed' }
      : lastCheck,
    quality_score: score || (requestType === 'unclear' ? null : 0),
  }
}
