export const paidSourceLabels = {
  weworkremotely: 'We Work Remotely',
  remoteok: 'Remote OK',
  github: 'GitHub paid bounties',
  mastodon: 'Mastodon hiring posts',
} as const

export type PaidSourceId = keyof typeof paidSourceLabels
export const paidSources = Object.keys(paidSourceLabels) as PaidSourceId[]

export function isPaidSource(id: string): id is PaidSourceId {
  return Object.hasOwn(paidSourceLabels, id)
}
