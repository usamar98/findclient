import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { sources, stageNames } from '@/lib/niche'
import { inboxHref, inboxPageSize, parseInboxFilters, type InboxParams } from '@/lib/inbox-filters'
import { queryInbox } from '@/lib/inbox-query'
import { LeadFilters } from './filters'
import './inbox.css'

export const metadata = { title: 'Lead inbox | Lead To Client' }

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const postedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default async function Inbox({ searchParams }: { searchParams: Promise<InboxParams> }) {
  const [{ db, user }, params] = await Promise.all([requireUser(), searchParams])
  const filters = parseInboxFilters(params)
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
  const clearHref = inboxHref(parseInboxFilters({ workspace: filters.workspace }))
  const active = inboxHref({ ...filters, sort: 'newest' }, 1) !== clearHref
  let hasSavedLeads = count > 0
  if (!hasSavedLeads && active) {
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
  const anyTime = filters.days ? inboxHref({ ...filters, days: undefined }, 1) : undefined
  const spaces = memberships.data.map(space => ({ ...space, name: space.id === user.id ? 'My workspace' : space.name }))
  const currentUrl = inboxHref(filters)

  return <>
    <div className="work-title-row">
      <h1>Lead inbox</h1>
      <div className="actions">
        <Link href={{ pathname: '/app/research', query: { q: filters.q, source: filters.source } }}>Live research</Link>
        {!shared && <Link className="work-scan-action" href="/app/scans">Scan now <span aria-hidden="true">↗</span></Link>}
      </div>
    </div>
    <LeadFilters key={currentUrl} filters={filters} clearHref={clearHref} spaces={spaces} searches={searches.data} />
    <section aria-labelledby="inbox-results-heading">
      <div className="inbox-results-heading">
        <h2 id="inbox-results-heading">{count} {active && hasSavedLeads ? 'matching ' : ''}{count === 1 ? 'lead' : 'leads'}</h2>
        {count > inboxPageSize && <p>Showing {offset + 1}–{Math.min(count, offset + inboxPageSize)} of {count}</p>}
      </div>
      {result.data.map(lead => <article key={lead.id} className="inbox-lead">
        <div className="inbox-lead-meta"><strong>{sources[lead.source as keyof typeof sources] ?? lead.source}</strong>
          <span>{stageNames[lead.status]}</span>
          <time dateTime={lead.posted_at}>{postedDate.format(new Date(lead.posted_at))}</time>
        </div>
        <h3><Link href={'/app/leads/' + lead.id}>{lead.title}</Link></h3>
        <p>{lead.problem_summary}</p>
        <div className="inbox-lead-facts"><span>Intent {lead.intent_score}/100</span>
          {lead.buyer_quality_score !== null && <span>Buyer quality {lead.buyer_quality_score}/100</span>}
          <span>{lead.assignee_id === user.id ? 'Assigned to you' : lead.assignee_id ? 'Assigned' : 'Unassigned'}</span>
          {lead.deal_value_cents > 0 && <span>Deal {currency.format(lead.deal_value_cents / 100)}</span>}
          {lead.follow_up_on && <span>Follow up <time dateTime={lead.follow_up_on}>{lead.follow_up_on}</time></span>}
        </div>
      </article>)}
      {!count && <div className="panel inbox-empty">
        {hasSavedLeads ? <>
          <h3>No saved leads match these filters</h3>
          {(filters.q || filters.days) && <p>{filters.q ? <>The title must contain “{filters.q}”. </> : null}
            {filters.days ? 'The date filter uses the original post date.' : null}</p>}
          <div className="inbox-empty-actions">
            {removeTitle && <Link href={removeTitle}>Remove title filter</Link>}
            {anyTime && <Link href={anyTime}>Include older posts</Link>}
            {clearHref !== removeTitle && clearHref !== anyTime && <Link href={clearHref}>Show all saved leads</Link>}
          </div>
        </> : <>
          <h3>No saved leads yet</h3>
          {shared ? <p>Ask the workspace owner to check their saved searches and scan receipts.</p>
            : !ownSearches.length ? <p><Link href="/app/onboarding">Create a saved search</Link> to choose your service and sources, then run a scan.</p>
            : !ownSearches.some(search => search.active) ? <p><Link href="/app/settings#saved-searches">Activate a saved search</Link> to start scanning for new leads.</p>
            : <p><Link href="/app/scans">Run a scan or check your scan receipts</Link> to see which sources returned posts and how many matched your saved search.</p>}
        </>}
      </div>}
    </section>
    {pages > 1 && <nav className="inbox-pages" aria-label="Inbox pages">
      <span>Page {filters.page} of {pages}</span>
      {filters.page > 1 && <Link href={inboxHref(filters, filters.page - 1)} rel="prev">Previous page</Link>}
      {filters.page < pages && <Link href={inboxHref(filters, filters.page + 1)} rel="next">Next page</Link>}
    </nav>}
  </>
}
