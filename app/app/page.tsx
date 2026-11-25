import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LatestScanReceipt } from '@/components/workspace/latest-scan-receipt'
import { admin } from '@/lib/db/admin'
import { requireUser } from '@/lib/db/server'
import { sources, stageNames } from '@/lib/niche'
import './dashboard.css'

export const metadata = { title: 'Dashboard | Lead To Client' }

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const inboxKeys = new Set(['workspace', 'service', 'assigned', 'due', 'q', 'source', 'status', 'score', 'days', 'sort', 'page'])
const operations = [
  { name: 'Live research', href: '/app/research', detail: 'Search public posts by keyword and publication time.' },
  { name: 'Saved searches', href: '/app/settings#saved-searches', detail: 'Manage the services, communities and keywords you monitor.' },
  { name: 'Scans', href: '/app/scans', detail: 'Run a saved search, set a credit limit or review a scan receipt.' },
  { name: 'Automations', href: '/app/automations', detail: 'Manage assignment rules, reply drafts and proposal follow-ups.' },
  { name: 'Proposals sent', href: '/app/inbox?status=proposal_sent', detail: 'Revisit leads in the proposal sent stage and plan your next follow-up.' },
  { name: 'Results', href: '/app/results', detail: 'Compare replies, calls and won revenue by source or saved search.' },
]

type DashboardLead = {
  id: string
  title: string
  source: string
  user_id: string
  status: keyof typeof stageNames
  intent_score: number
  follow_up_on: string | null
}

function followUpLabel(lead: DashboardLead, today: string) {
  if (!lead.follow_up_on) return stageNames[lead.status]
  const date = lead.follow_up_on.slice(0, 10)
  const when = date === today
    ? 'Due today'
    : 'Overdue since ' + shortDate.format(new Date(date + 'T00:00:00Z'))
  return when + ' · ' + stageNames[lead.status]
}

function LeadQueue({ leads, due, today, owners }: {
  leads: DashboardLead[]
  due?: boolean
  today: string
  owners: Map<string, string>
}) {
  const title = due ? 'Follow-ups due' : 'New leads to review'
  const href = due ? '/app/inbox?due=yes' : '/app/inbox?status=new'
  return (
    <section className="dashboard-queue">
      <div className="dashboard-section-head">
        <h2>{title}</h2>
        <Link href={href} aria-label={`View all ${title.toLowerCase()}`}>View all</Link>
      </div>
      {leads.length === 0 ? (
        <p className="dashboard-empty">{due ? 'No follow-ups are due today.' : 'New leads appear here when a scan finds a matching request.'}</p>
      ) : (
        <ul className="dashboard-leads">
          {leads.map(lead => (
            <li key={lead.id}>
              <Link href={'/app/leads/' + lead.id}>
                <span className="dashboard-lead-meta">
                  {sources[lead.source as keyof typeof sources] ?? lead.source}
                  {owners.size > 1 && ' · ' + (owners.get(lead.user_id) ?? 'Shared workspace')}
                </span>
                <strong>{lead.title}</strong>
                <span className="dashboard-lead-detail">
                  {due ? followUpLabel(lead, today) : 'Intent ' + lead.intent_score + '/100'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function Dashboard({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  if (Object.keys(params).some(key => inboxKeys.has(key))) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') query.append(key, value)
      else value?.forEach(item => query.append(key, item))
    }
    redirect('/app/inbox?' + query.toString())
  }

  const { db, user } = await requireUser()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const leadFields = 'id,user_id,title,source,status,intent_score,follow_up_on'
  const [profile, spaces, searches, invitations, recent, due, totals] = await Promise.all([
    db.from('profiles').select('credits').eq('id', user.id).single(),
    admin().rpc('list_workspaces', { p_actor: user.id }),
    db.from('niches').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    db.from('workspace_invites').select('id', { count: 'exact', head: true })
      .neq('owner_id', user.id).gt('expires_at', now.toISOString()),
    db.from('leads').select(leadFields, { count: 'exact' }).eq('status', 'new')
      .order('created_at', { ascending: false }).order('id').limit(4),
    db.from('leads').select(leadFields, { count: 'exact' }).lte('follow_up_on', today)
      .order('follow_up_on').order('id').limit(4),
    db.rpc('pipeline_totals', { p_owner: null }).single(),
  ])
  if (profile.error || spaces.error || searches.error || invitations.error || recent.error || due.error || totals.error) {
    throw new Error('Dashboard unavailable')
  }
  const owners = new Map(spaces.data.map(space => [space.id, space.id === user.id ? 'My workspace' : space.name]))
  const hasSearch = (searches.count ?? 0) > 0
  const metrics = [
    { label: 'New leads', value: recent.count ?? 0, href: '/app/inbox?status=new' },
    { label: 'Follow-ups due', value: due.count ?? 0, href: '/app/inbox?due=yes' },
    { label: 'Won revenue', value: dollars.format(totals.data.revenue_cents / 100), href: '/app/inbox?status=won' },
    { label: 'Your credits', value: profile.data.credits, href: '/app/profile' },
  ]
  return (
    <div className="dashboard">
      <div className="work-title-row">
        <div>
          <h1>Dashboard</h1>
          {owners.size > 1 && <p>Lead activity across your {owners.size} workspaces.</p>}
        </div>
        <div className="actions">
          <Link href="/app/inbox?assigned=me">Assigned to me</Link>
          <Link className="work-scan-action" href="/app/inbox">Open lead inbox <span aria-hidden="true">↗</span></Link>
        </div>
      </div>

      <div className="dashboard-metrics">
        {metrics.map(metric => (
          <Link href={metric.href} key={metric.label}>
            <span>{metric.label}</span><strong>{metric.value}</strong>
          </Link>
        ))}
      </div>
      {Boolean(invitations.count) && (
        <div className="dashboard-notice"><p>You have a pending workspace invitation.</p><Link href="/app/settings#team">Review invitations</Link></div>
      )}
      {!hasSearch && (
        <div className="dashboard-notice">
          <div><h2>Set up your first search</h2><p>Choose your service and the communities you want to monitor.</p></div>
          <Link href="/app/onboarding">Create a saved search</Link>
        </div>
      )}
      <div className="dashboard-queues">
        <LeadQueue due leads={due.data} today={today} owners={owners} />
        <LeadQueue leads={recent.data} today={today} owners={owners} />
      </div>
      <section className="dashboard-tools" aria-labelledby="workspace-tools">
        <h2 id="workspace-tools">Workspace tools</h2>
        <div className="dashboard-tool-links">
          {operations.map(tool => <Link href={tool.href} key={tool.href}>
            <strong>{tool.name} <span aria-hidden="true">↗</span></strong><span>{tool.detail}</span>
          </Link>)}
        </div>
      </section>
      <LatestScanReceipt ownerId={user.id} />
    </div>
  )
}
