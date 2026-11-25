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
    db.from('niches').select('id,skill,user_id').order('skill'),
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
  const active = inboxHref({ ...filters, sort: 'newest' }, 1) !== '/app/inbox'
  const spaces = memberships.data.map(space => ({ ...space, name: space.id === user.id ? 'My workspace' : space.name }))
  const currentUrl = inboxHref(filters)

  return <>
    <div className="work-title-row">
      <h1>Lead inbox</h1>
      <Link className="work-scan-action" href="/app/scans">Scan now <span aria-hidden="true">↗</span></Link>
    </div>
    <LeadFilters key={currentUrl} filters={filters} spaces={spaces} searches={searches.data} />
    <section aria-labelledby="inbox-results-heading">
      <div className="inbox-results-heading">
        <h2 id="inbox-results-heading">{count} {active ? 'matching ' : ''}{count === 1 ? 'lead' : 'leads'}</h2>
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
        <h3>{active ? 'No leads match these filters' : 'Your inbox is empty'}</h3>
        {active
          ? <p>Try another source or a broader score range, or <Link href="/app/inbox">clear all filters</Link>.</p>
          : <p><Link href="/app/settings">Set up your searches</Link> or <Link href="/app/scans">run a scan</Link> to find leads.</p>}
      </div>}
    </section>
    {pages > 1 && <nav className="inbox-pages" aria-label="Inbox pages">
      <span>Page {filters.page} of {pages}</span>
      {filters.page > 1 && <Link href={inboxHref(filters, filters.page - 1)} rel="prev">Previous page</Link>}
      {filters.page < pages && <Link href={inboxHref(filters, filters.page + 1)} rel="next">Next page</Link>}
    </nav>}
  </>
}
