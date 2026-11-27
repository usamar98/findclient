import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './db/schema'
import { inboxPageSize, type InboxFilters } from './inbox-filters'
import { leadTitleSearchGroups, researchMatchPlan } from './research-matching'

const sortColumns = {
  newest: 'posted_at', score: 'intent_score', buyer: 'buyer_quality_score', value: 'deal_value_cents', followup: 'follow_up_on',
} as const

const leadColumns = 'id,source,title,posted_at,intent_score,buyer_quality_score,problem_summary,status,assignee_id,deal_value_cents,follow_up_on'
const applicationColumns = `${leadColumns},applied_at` as const

// The API treats every imatch on a column as AND. One regex alternation is
// an OR group. Only our separators and boundaries become regex operators.
function titleGroupRegex(alternatives: readonly string[]) {
  const escaped = alternatives.map(alias => alias.split(/\s+/).map(part =>
    part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[[:space:]-]+'))
  return '(^|[^[:alnum:].+#])(' + escaped.join('|') + ')($|[^[:alnum:].+#]|[.]($|[^[:alnum:]]))'
}

export async function queryInbox(db: SupabaseClient<Database>, userId: string, filters: InboxFilters, now = new Date()) {
  const result = await fetchRows(db, userId, filters, now, true)
  // Preserve the existing inbox during the interval between deployment and the database migration.
  if (result.error && ['42703', 'PGRST204'].includes(result.error.code) && /\bapplied_at\b/.test(result.error.message)) {
    return fetchRows(db, userId, filters, now, false)
  }
  return result
}

function fetchRows(db: SupabaseClient<Database>, userId: string, filters: InboxFilters, now: Date, withApplications: boolean) {
  const today = now.toISOString().slice(0, 10)
  const day = 86400000
  const offset = (filters.page - 1) * inboxPageSize
  const leads = db.from('leads')
  let query = withApplications
    ? leads.select(applicationColumns, { count: 'exact' })
    : leads.select(leadColumns, { count: 'exact' })
  if (filters.workspace) query = query.eq('user_id', filters.workspace)
  if (filters.service) query = query.eq('niche_id', filters.service)
  if (filters.q) {
    const groups = leadTitleSearchGroups(researchMatchPlan(filters.q))
    if (!groups.length) query = query.is('id', null)
    for (const aliases of groups) query = query.regexIMatch('title', titleGroupRegex(aliases))
  }
  if (filters.source.length) query = query.in('source', filters.source)
  if (filters.status.length) query = query.in('status', filters.status)
  if (filters.application) {
    query = withApplications ? query.not('applied_at', 'is', null) : query.is('id', null)
  }
  if (filters.score) query = query.gte('intent_score', filters.score)
  if (filters.quality) query = query.gte('buyer_quality_score', filters.quality)
  if (filters.value) query = query.gte('deal_value_cents', Math.round(filters.value * 100))
  if (!filters.view) {
    const since = new Date(now.getTime() - Number(filters.window) * 60_000)
    query = query.gte('posted_at', since.toISOString()).lte('posted_at', now.toISOString())
  }
  if (filters.assigned === 'me') query = query.eq('assignee_id', userId)
  if (filters.assigned === 'unassigned') query = query.is('assignee_id', null)
  if (filters.due === 'yes') query = query.lte('follow_up_on', today)
  if (filters.due === 'next7') query = query.gt('follow_up_on', today).lte('follow_up_on', new Date(now.getTime() + 7 * day).toISOString().slice(0, 10))
  if (filters.due === 'none') query = query.is('follow_up_on', null)
  query = query.order(sortColumns[filters.sort], { ascending: filters.sort === 'followup', nullsFirst: false })
  if (filters.sort !== 'newest') query = query.order('posted_at', { ascending: false })
  return query.order('id').range(offset, offset + inboxPageSize - 1)
}
