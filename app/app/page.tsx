import Link from 'next/link'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { sources, stageNames, statuses } from '@/lib/niche'
import './agency-inbox.css'
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const query = z.object({
  workspace: z.uuid().optional().catch(undefined),
  service: z.uuid().optional().catch(undefined),
  assigned: z.enum(['me', 'unassigned']).optional().catch(undefined),
  due: z.enum(['yes']).optional().catch(undefined),
  q: z.string().trim().max(100).catch(''),
  source: z
    .enum(
      Object.keys(sources) as [
        keyof typeof sources,
        ...(keyof typeof sources)[],
      ],
    )
    .optional()
    .catch(undefined),
  status: z.enum(statuses).optional().catch(undefined),
  score: z.coerce.number().int().min(0).max(100).catch(0),
  days: z.enum(['1', '3', '7', '30']).optional().catch(undefined),
  sort: z.enum(['newest', 'score', 'buyer']).catch('newest'),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
})
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { db, user } = await requireUser(),
    f = query.parse(await searchParams)
  const [profileResult, spaces, niches, invitations] = await Promise.all([
    db.from('profiles').select('credits,onboarding_done').eq('id', user.id).single(),
    admin().rpc('list_workspaces', { p_actor: user.id }),
    db.from('niches').select('id,skill,user_id').order('skill'),
    db.from('workspace_invites').select('id', { head: true, count: 'exact' })
      .neq('owner_id', user.id).gt('expires_at', new Date().toISOString()),
  ])
  if (profileResult.error || spaces.error || niches.error || invitations.error) throw new Error('Workspace unavailable')
  const profile = profileResult.data
  if (!profile.onboarding_done && spaces.data.length === 1) {
    redirect(invitations.count ? '/app/settings#team' : '/app/onboarding')
  }
  const today = new Date().toISOString().slice(0, 10)
  let request = db
    .from('leads')
    .select('id,user_id,source,title,posted_at,intent_score,buyer_quality_score,problem_summary,status,assignee_id,deal_value_cents,follow_up_on', {
      count: 'exact',
    })
    .gte('intent_score', f.score)
  if (f.workspace) request = request.eq('user_id', f.workspace)
  if (f.service) request = request.eq('niche_id', f.service)
  if (f.assigned === 'me') request = request.eq('assignee_id', user.id)
  if (f.assigned === 'unassigned') request = request.is('assignee_id', null)
  if (f.due) request = request.lte('follow_up_on', today)
  if (f.q)
    request = request.ilike('title', '%' + f.q.replace(/[\\%_]/g, '\\$&') + '%')
  if (f.status) request = request.eq('status', f.status)
  if (f.source) request = request.eq('source', f.source)
  if (f.days)
    request = request.gte(
      'posted_at',
      new Date(Date.now() - Number(f.days) * 86400000).toISOString(),
    )
  const [result, stats] = await Promise.all([
    request
      .order(f.sort === 'buyer' ? 'buyer_quality_score' : f.sort === 'score' ? 'intent_score' : 'posted_at', {
        ascending: false,
        nullsFirst: false,
      })
      .order('id')
      .range((f.page - 1) * 20, f.page * 20 - 1),
    db.rpc('pipeline_totals', { p_owner: f.workspace ?? null }).single(),
  ])
  if (result.error || stats.error)
    throw new Error('Inbox unavailable')
  function pageHref(page: number) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(f))
      if (v !== undefined) params.set(k, String(v))
    params.set('page', String(page))
    return '/app?' + params
  }
  return (
    <>
      <p className="meta">Your account · {profile.credits} credits available</p>
      <h1>Lead inbox</h1>
      {Boolean(invitations.count) && <p><Link href="/app/settings#team">Review pending workspace invitations</Link></p>}
      {profile.credits === 0 && spaces.data.length === 1 && (
        <p>New searches and replies need credits. <Link href="/pricing">View pricing</Link></p>
      )}
      <div className="stats cf-inbox-stats">
        {[
          ['Leads found', stats.data.found], ['Replied or later', stats.data.replied], ['Won', stats.data.won],
          ['Revenue won with Clientfind', money.format(stats.data.revenue_cents / 100)],
        ].map(([label, value]) => (
          <div key={label}>
            <b>{value}</b>
            {label}
          </div>
        ))}
      </div>
      {stats.data.by_source.length > 0 && <details className="panel cf-won-sources">
        <summary>Won revenue by source</summary>
        <table>
          <thead><tr><th scope="col">Source</th><th scope="col">Deals won</th><th scope="col">Revenue (USD)</th></tr></thead>
          <tbody>{stats.data.by_source.map(s => <tr key={s.source}>
            <th scope="row">{sources[s.source as keyof typeof sources] ?? s.source}</th><td>{s.wins}</td>
            <td>{money.format(s.amount_cents / 100)}</td></tr>)}</tbody>
        </table>
      </details>}
      <form className="filters panel">
        {spaces.data.length > 1 && <label>Workspace<select name="workspace" defaultValue={f.workspace}>
          <option value="">All workspaces</option>
          {spaces.data.map(s => <option key={s.id} value={s.id}>{s.id === user.id ? 'My workspace' : s.name}</option>)}
        </select></label>}
        <label>Service search<select name="service" defaultValue={f.service}>
          <option value="">All searches</option>
          {niches.data.filter(n => !f.workspace || n.user_id === f.workspace).map(n => <option key={n.id} value={n.id}>{n.skill}</option>)}
        </select></label>
        <label>Assigned to<select name="assigned" defaultValue={f.assigned}>
          <option value="">Anyone</option><option value="me">Me</option><option value="unassigned">Unassigned</option>
        </select></label>
        <label>Follow-ups<select name="due" defaultValue={f.due}>
          <option value="">All dates</option><option value="yes">Due today or overdue</option>
        </select></label>
        <label>
          Search title
          <input name="q" defaultValue={f.q} maxLength={100} />
        </label>
        <label>
          Source
          <select name="source" defaultValue={f.source}>
            <option value="">All sources</option>
            {Object.entries(sources).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={f.status}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option value={s} key={s}>{stageNames[s]}</option>
            ))}
          </select>
        </label>
        <label>
          Min. score
          <input
            type="number"
            name="score"
            min={0}
            max={100}
            defaultValue={f.score}
          />
        </label>
        <label>
          Posted
          <select name="days" defaultValue={f.days}>
            <option value="">Any date</option>
            {['1', '3', '7', '30'].map((d) => (
              <option key={d} value={d}>
                Past {d} days
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={f.sort}>
            <option value="newest">Newest</option>
            <option value="score">Highest score</option>
            <option value="buyer">Highest buyer quality</option>
          </select>
        </label>
        <button>Apply filters</button>
      </form>
      {result.data?.length ? (
        result.data.map((l) => (
          <article key={l.id}>
            <p className="meta">
              {sources[l.source as keyof typeof sources]} · Intent {l.intent_score}/100
              {l.buyer_quality_score !== null && ' · Buyer quality ' + l.buyer_quality_score + '/100'}
              · {stageNames[l.status]} ·{' '}
              {new Date(l.posted_at).toLocaleDateString('en-US', {
                timeZone: 'UTC',
              })}
            </p>
            <h2>
              <Link href={'/app/leads/' + l.id}>{l.title}</Link>
            </h2>
            <p>{l.problem_summary}</p>
            <p className="meta">
              {l.assignee_id === user.id ? 'Assigned to you' : l.assignee_id ? 'Assigned' : 'Unassigned'}
              {l.deal_value_cents > 0 && ' · ' + money.format(l.deal_value_cents / 100)}
              {l.follow_up_on && ' · Follow up ' + l.follow_up_on}
            </p>
          </article>
        ))
      ) : (
        <section className="panel">
          <h2>No matching leads yet</h2>
          <p>
            Scans add recent requests that meet your score threshold.
            You can adjust the keywords and sources in settings.
          </p>
          <Link href="/app/settings">Manage your niches</Link>
        </section>
      )}
      <nav aria-label="Inbox pages">
        {f.page > 1 && <Link href={pageHref(f.page - 1)}>Previous page</Link>}
        {(result.count ?? 0) > f.page * 20 && (
          <Link href={pageHref(f.page + 1)}>Next page</Link>
        )}
      </nav>
    </>
  )
}
