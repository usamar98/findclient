import { z } from 'zod'
import { sources, statuses } from './niche'

export type InboxParams = Record<string, string | string[] | undefined>
export const inboxPageSize = 20
export const sourceIds = Object.keys(sources) as (keyof typeof sources)[]

const choices = z.object({
  workspace: z.uuid().optional().catch(undefined),
  service: z.uuid().optional().catch(undefined),
  assigned: z.enum(['me', 'unassigned']).optional().catch(undefined),
  due: z.enum(['yes', 'next7', 'none']).optional().catch(undefined),
  q: z.string().trim().max(100).catch(''),
  score: z.coerce.number().int().min(0).max(100).catch(0),
  quality: z.coerce.number().int().min(0).max(100).catch(0),
  value: z.coerce.number().min(0).max(21474836.47).catch(0),
  days: z.enum(['1', '3', '7', '30']).optional().catch(undefined),
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
    source: selected(params.source, sourceIds),
    status: selected(params.status, statuses),
  }
}

export type InboxFilters = ReturnType<typeof parseInboxFilters>

export function inboxHref(filters: InboxFilters, page = filters.page) {
  const params = new URLSearchParams()
  for (const key of ['workspace', 'service', 'assigned', 'due', 'q', 'days'] as const) {
    if (filters[key]) params.set(key, filters[key])
  }
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

export function advancedFiltersActive(filters: InboxFilters) {
  return Boolean(filters.assigned || filters.due || filters.status.length || filters.score || filters.quality || filters.value)
}
