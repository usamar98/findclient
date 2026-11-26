import { sources } from './niche'
import type { NormalizedPost } from './sources/shared'

const paidSourceLabels = {
  weworkremotely: 'We Work Remotely',
  remoteok: 'Remote OK',
  github: 'GitHub paid bounties',
  mastodon: 'Mastodon hiring posts',
} as const

export const researchSourceLabels = { ...sources, ...paidSourceLabels }
export type ResearchSourceId = keyof typeof researchSourceLabels
export type PaidSourceId = keyof typeof paidSourceLabels
export const paidSources = Object.keys(paidSourceLabels) as PaidSourceId[]
export const researchSources = Object.keys(researchSourceLabels) as ResearchSourceId[]
export const keylessSources: ResearchSourceId[] = ['hn', 'bluesky', 'stackexchange', 'shopify', 'forums', ...paidSources]
export const researchSourceNotes: Partial<Record<ResearchSourceId, string>> = {
  weworkremotely: 'We Work Remotely specifies an hourly feed refresh.',
  remoteok: 'Age uses the Remote OK listing date. Employers can renew listings.',
  github: 'Open, unassigned issues with a cash bounty offered by a maintainer.',
  mastodon: 'Original public hiring posts from selected tags visible on mastodon.social.',
}

export function isPaidSource(id: string): id is PaidSourceId {
  return Object.hasOwn(paidSourceLabels, id)
}

export type PaidProjectPost = Omit<NormalizedPost, 'source' | 'posted_precision'> & {
  source: PaidSourceId
  engagement: 'paid_freelance'
  compensation?: string
  posted_precision?: never
}
export type ResearchCandidate = NormalizedPost | PaidProjectPost
export type CandidateTime = Pick<ResearchCandidate, 'url' | 'posted_at'>
