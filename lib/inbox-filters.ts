import { z } from 'zod'
import { statuses } from './niche'
import { isPaidSource, researchSources } from './research-catalog'
import { parseResearchWindow } from './research-windows'
import { validJobKeyword } from './lead-title-search'

export type InboxParams = Record<string, string | string[] | undefined>
export const inboxPageSize = 20

const choices = z.object({
  workspace: z.uuid().optional().catch(undefined),
  service: z.uuid().optional().catch(undefined),
  assigned: z.enum(['me', 'unassigned']).optional().catch(undefined),
  application: z.literal('applied').optional().catch(undefined),
  due: z.enum(['yes', 'next7', 'none']).optional().catch(undefined),
  q: z.string().trim().transform(value => value.slice(0, 100)).catch(''),
  score: z.coerce.number().int().min(0).max(100).catch(0),
  quality: z.coerce.number().int().min(0).max(100).catch(0),
  value: z.coerce.number().min(0).max(21474836.47).catch(0),
  view: z.literal('history').optional().catch(undefined),
  sort: z.enum(['newest', 'score', 'buyer', 'value', 'followup']).catch('newest'),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
})

function selected<T extends string>(values: InboxParams[string], allowed: readonly T[]): T[] {
  const submitted = Array.isArray(values) ? values : [values]
  return allowed.filter(value => submitted.includes(value))
}

export function parseInboxFilters(params: InboxParams) {
  const singles = Object.fromEntries(Object.entries(params).map(([key, value]) => [
    key, Array.isArray(value) ? value[0] : value,
  ]))
  return {
    ...choices.parse(singles),
    // Older links expressed the age in days. Every former day window now
    // resolves to the maximum supported publication age of 24 hours.
    window: parseResearchWindow(singles.window, '1440'),
    source: selected(params.source, researchSources),
    status: selected(params.status, statuses),
  }
}

export type InboxFilters = ReturnType<typeof parseInboxFilters>

export function inboxHref(filters: InboxFilters, page = filters.page) {
  const params = new URLSearchParams()
  for (const key of ['workspace', 'service', 'assigned', 'application', 'due', 'q', 'view'] as const) {
    if (filters[key]) params.set(key, filters[key])
  }
  if (!filters.view && filters.window !== '1440') params.set('window', filters.window)
  for (const key of ['score', 'quality', 'value'] as const) {
    if (filters[key] > 0) params.set(key, String(filters[key]))
  }
  for (const key of ['source', 'status'] as const) {
    for (const value of filters[key]) params.append(key, value)
  }
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  if (page > 1) params.set('page', String(page))
  return params.size ? '/app/inbox?' + params.toString() : '/app/inbox'
}

export function inboxResearchHref(filters: InboxFilters, run = false) {
  const params = new URLSearchParams({ window: filters.window })
  if (filters.q) params.set('q', filters.q)
  const sources = filters.source.length || !filters.q ? filters.source : researchSources
  for (const source of sources) params.append('source', source)
  if (run && (validJobKeyword(filters.q) || (!filters.q && sources.length && sources.every(isPaidSource)))) params.set('run', '1')
  return '/app/research?' + params.toString()
}

export function isInboxNavigation(headers: Pick<Headers, 'get'>) {
  const origin = headers.get('referer')
  if (!origin || !URL.canParse(origin)) return false
  const site = headers.get('sec-fetch-site')
  const url = new URL(origin)
  return (!site || site === 'same-origin') && url.host === headers.get('host') && url.pathname === '/app/inbox'
}

export function advancedFiltersActive(filters: InboxFilters) {
  return Boolean(filters.assigned || filters.application || filters.due || filters.status.length || filters.score || filters.quality || filters.value)
}
