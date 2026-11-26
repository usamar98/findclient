import { sources } from './niche'
import { paidSourceLabels, paidSources, type PaidSourceId } from './paid-sources'
import type { NormalizedPost } from './sources/shared'
export { isPaidSource, paidSources, type PaidSourceId } from './paid-sources'

export const researchSourceLabels = { ...sources, ...paidSourceLabels }
export type ResearchSourceId = keyof typeof researchSourceLabels
export const researchSources = Object.keys(researchSourceLabels) as ResearchSourceId[]
export type DailyJobSource = PaidSourceId | 'hn' | 'bluesky'
export const dailyJobSources: DailyJobSource[] = [...paidSources, 'hn', 'bluesky']
export function isDailyJobSource(source: string): source is DailyJobSource {
  return source === 'hn' || source === 'bluesky' || Object.hasOwn(paidSourceLabels, source)
}
export const keylessSources: ResearchSourceId[] = ['hn', 'bluesky', 'stackexchange', 'shopify', 'forums', ...paidSources]
export const researchSourceNotes: Partial<Record<ResearchSourceId, string>> = {
  weworkremotely: 'We Work Remotely specifies an hourly feed refresh.',
  remoteok: 'Age uses the Remote OK listing date. Employers can renew listings.',
  github: 'Open, unassigned issues with a cash bounty offered by a maintainer.',
  mastodon: 'Original public hiring posts from selected tags visible on mastodon.social.',
}

type JobDetails = Omit<NormalizedPost, 'source' | 'posted_precision'> & {
  source: DailyJobSource
  first_found_at?: string
  posted_precision?: never
}
export type PaidProjectPost = JobDetails & { engagement: 'paid_freelance'; compensation?: string }
export type UnpricedContract = JobDetails & { engagement: 'contract_pay_unlisted'; compensation?: never }
export type JobListing = PaidProjectPost | UnpricedContract
export type ResearchCandidate = NormalizedPost | JobListing
export type CandidateTime = Pick<ResearchCandidate, 'url' | 'posted_at'>
