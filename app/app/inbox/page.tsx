import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { stageNames } from '@/lib/niche'
import { researchSourceLabels, type ResearchSourceId } from '@/lib/research-catalog'
import { inboxHref, inboxPageSize, inboxResearchHref, isInboxNavigation, parseInboxFilters, type InboxParams } from '@/lib/inbox-filters'
import { researchWindows } from '@/lib/research-windows'
import { queryInbox } from '@/lib/inbox-query'
import { LeadFilters } from './filters'
import './inbox.css'

export const metadata = { title: 'Lead inbox | Lead To Client' }

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const postedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })

export default async function Inbox({ searchParams }: { searchParams: Promise<InboxParams> }) {
  const [{ db, user }, params] = await Promise.all([requireUser(), searchParams])
  const filters = parseInboxFilters(params)
  if (params.run === '1') redirect(inboxResearchHref(filters, isInboxNavigation(await headers())))
  if (params.days !== undefined) redirect(inboxHref(filters, 1))
  const offset = (filters.page - 1) * inboxPageSize
  const [result, memberships, searches] = await Promise.all([
    queryInbox(db, user.id, filters),
    admin().rpc('list_workspaces', { p_actor: user.id }),
    db.from('niches').select('id,skill,user_id,active').order('skill'),
  ])
  if (memberships.error || searches.error) throw new Error('Unable to load the inbox filters.')
  if (filters.workspace && !memberships.data.some(space => space.id === filters.workspace)) notFound()
  if (filters.service) {
    const search = searches.data.find(row => row.id === filters.service)
    if (!search) notFound()
    if (filters.workspace && search.user_id !== filters.workspace) redirect(inboxHref({ ...filters, service: undefined }, 1))
  }
  // PostgREST can return 416 if a bookmarked page no longer contains any rows.
  if (result.error?.code === 'PGRST103' && filters.page > 1) redirect(inboxHref(filters, 1))
  if (result.error) throw new Error('Unable to load leads.')
  const count = result.count ?? 0
  const pages = Math.max(1, Math.ceil(count / inboxPageSize))
  if (filters.page > pages) redirect(inboxHref(filters, pages))
  const clearHref = inboxHref(parseInboxFilters({ workspace: filters.workspace, view: filters.view }))
  const active = inboxHref({ ...filters, sort: 'newest' }, 1) !== clearHref
  let hasSavedLeads = count > 0
  if (!hasSavedLeads && (!filters.view || active)) {
    let probe = db.from('leads').select('id').limit(1)
    if (filters.workspace) probe = probe.eq('user_id', filters.workspace)
    const saved = await probe
    if (saved.error) throw new Error('Unable to check for saved leads.')
    hasSavedLeads = saved.data.length > 0
  }
  const owner = filters.workspace ?? searches.data.find(search => search.id === filters.service)?.user_id
  const shared = Boolean(owner && owner !== user.id)
  const ownSearches = searches.data.filter(search => search.user_id === user.id)
  const removeTitle = filters.q ? inboxHref({ ...filters, q: '' }, 1) : undefined
  const historyHref = inboxHref({ ...filters, view: 'history' }, 1)
  const recentHref = inboxHref({ ...filters, view: undefined }, 1)
  const spaces = memberships.data.map(space => ({ ...space, name: space.id === user.id ? 'My workspace' : space.name }))
  const currentUrl = inboxHref(filters)

  return <>
    <div className="work-title-row">
      <h1>Lead inbox</h1>
      <div className="actions">
        <Link href={inboxResearchHref(filters)}>Live research</Link>
        {!shared && <Link className="work-scan-action" href="/app/scans">Scan now <span aria-hidden="true">↗</span></Link>}
      </div>
    </div>
    <nav className="inbox-views" aria-label="Saved lead views">
      <Link href={recentHref} aria-current={!filters.view ? 'page' : undefined}>Recent saved leads</Link>
      <Link href={historyHref} aria-current={filters.view ? 'page' : undefined}>Saved history</Link>
    </nav>
    <LeadFilters key={currentUrl} filters={filters} clearHref={clearHref} spaces={spaces} searches={searches.data} />
    <section aria-labelledby="inbox-results-heading">
      <div className="inbox-results-heading">
        <h2 id="inbox-results-heading">{count} {active && hasSavedLeads ? 'matching ' : ''}{count === 1 ? 'lead' : 'leads'}</h2>
        {count > inboxPageSize && <p>Showing {offset + 1}–{Math.min(count, offset + inboxPageSize)} of {count}</p>}
      </div>
      {result.data.map(lead => {
        const appliedAt = 'applied_at' in lead && typeof lead.applied_at === 'string' ? lead.applied_at : null
        const canFollowUp = (appliedAt || lead.status === 'saved') && !['won', 'lost', 'ignored'].includes(lead.status)
        return <article key={lead.id} className="inbox-lead">
          <div className="inbox-lead-meta"><strong>{researchSourceLabels[lead.source as ResearchSourceId] ?? lead.source}</strong>
            <span>{stageNames[lead.status]}</span>
            <time dateTime={lead.posted_at}>{postedDate.format(new Date(lead.posted_at))}</time>
          </div>
          <h3><Link href={'/app/leads/' + lead.id}>{lead.title}</Link></h3>
          <p>{lead.problem_summary}</p>
          <div className="inbox-lead-facts">
            {appliedAt && <span>Applied <time dateTime={appliedAt}>{postedDate.format(new Date(appliedAt))}</time></span>}
            {lead.intent_score !== null && <span>Intent {lead.intent_score}/100</span>}
            {lead.buyer_quality_score !== null && <span>Buyer quality {lead.buyer_quality_score}/100</span>}
            <span>{lead.assignee_id === user.id ? 'Assigned to you' : lead.assignee_id ? 'Assigned' : 'Unassigned'}</span>
            {lead.deal_value_cents > 0 && <span>Deal {currency.format(lead.deal_value_cents / 100)}</span>}
            {lead.follow_up_on && <span>Follow up <time dateTime={lead.follow_up_on}>{lead.follow_up_on}</time></span>}
            {canFollowUp && <Link href={'/app/leads/' + lead.id + '#pipeline'}>{lead.follow_up_on ? 'Edit follow-up' : 'Set follow-up'}</Link>}
          </div>
        </article>
      })}
      {!count && <div className="panel inbox-empty">
        {hasSavedLeads ? <>
          <h3>{!filters.view && !active ? 'No saved leads were posted in the past 24 hours' : 'No saved leads match these filters'}</h3>
          {filters.q && <p>Looking for titles matching “{filters.q}”.</p>}
          {!filters.view && active && <p>{researchWindows[filters.window]} by original posting time.</p>}
          <div className="inbox-empty-actions">
            {removeTitle && <Link href={removeTitle}>Remove title filter</Link>}
            {!filters.view && <Link href={historyHref}>Check saved history</Link>}
            {active && clearHref !== removeTitle && <Link href={clearHref}>Clear filters</Link>}
          </div>
        </> : <>
          <h3>No saved leads yet</h3>
          {!shared && <p><Link href="/app/jobs">Browse 24-hour Jobs</Link> and select <strong>Save to inbox</strong> on an opening you want to track.</p>}
          {shared ? <p>Ask the workspace owner to check their saved searches and scan receipts.</p>
            : !ownSearches.length ? <p><Link href="/app/onboarding">Create a saved search</Link> to choose your service and sources, then run a scan.</p>
            : !ownSearches.some(search => search.active) ? <p><Link href="/app/settings#saved-searches">Activate a saved search</Link> to start scanning for new leads.</p>
            : <p><Link href="/app/scans">Run a scan or check your scan receipts</Link> to see which sources returned posts and how many matched your saved search.</p>}
        </>}
        {filters.q && <p><a href={inboxResearchHref(filters, true)}>Search live for “{filters.q}”</a></p>}
      </div>}
    </section>
    {pages > 1 && <nav className="inbox-pages" aria-label="Inbox pages">
      <span>Page {filters.page} of {pages}</span>
      {filters.page > 1 && <Link href={inboxHref(filters, filters.page - 1)} rel="prev">Previous page</Link>}
      {filters.page < pages && <Link href={inboxHref(filters, filters.page + 1)} rel="next">Next page</Link>}
    </nav>}
  </>
}
