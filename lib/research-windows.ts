export const researchWindows = {
  '1': 'Past minute',
  '5': 'Past 5 minutes',
  '15': 'Past 15 minutes',
  '30': 'Past 30 minutes',
  '60': 'Past hour',
  '360': 'Past 6 hours',
  '1440': 'Past 24 hours',
} as const

export type ResearchWindow = keyof typeof researchWindows
export const maxJobAgeMs = 24 * 60 * 60_000

// Every source must supply an instant with a timezone. A calendar date alone
// would otherwise be interpreted as midnight and could enter a minute search.
export function inPublicationWindow(value: string, start: number, end: number) {
  if (!/T\d\d:\d\d.*(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return false
  const published = Date.parse(value)
  return published >= start && published <= end
}

export function parseResearchWindow(value: unknown, fallback: ResearchWindow): ResearchWindow {
  return typeof value === 'string' && Object.hasOwn(researchWindows, value) ? value as ResearchWindow : fallback
}
