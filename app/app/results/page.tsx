import Link from 'next/link'
import { notFound } from 'next/navigation'
import { admin } from '@/lib/db/admin'
import { missingDatabaseResource } from '@/lib/db/missing-resource'
import { requireUser } from '@/lib/db/server'
import { sources } from '@/lib/niche'
import './results.css'

export const metadata = { title: 'Results | Lead To Client' }

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const integer = new Intl.NumberFormat('en-US')

export default async function Results({ searchParams }: {
  searchParams: Promise<{ workspace?: string; group?: string }>
}) {
  const { user, db } = await requireUser()
  const params = await searchParams
  const owner = params.workspace || user.id
  const group = params.group === 'search' ? 'search' : 'platform'
  const { data: workspaces, error: workspaceError } = await admin().rpc('list_workspaces', { p_actor: user.id })
  if (workspaceError) throw new Error('Workspace list unavailable')
  if (!workspaces.some(space => space.id === owner)) notFound()
  const { data: results, error } = await db.rpc('workspace_results', { p_owner: owner, p_group: group })
  if (missingDatabaseResource(error, 'function', 'workspace_results')) return <section>
    <h1>Results</h1>
    <p>Apply the workspace results migration in Supabase to enable reporting.</p>
    <Link href="/app/inbox">Open the lead inbox</Link>
  </section>
  if (error) throw new Error('Workspace results unavailable')

  const showCosts = owner === user.id
  const total = results.reduce((sum, row) => ({
    leads: sum.leads + row.leads_found,
    calls: sum.calls + row.calls,
    won: sum.won + row.wins,
    revenue: sum.revenue + row.revenue_cents,
  }), { leads: 0, calls: 0, won: 0, revenue: 0 })
  const workspaceQuery = new URLSearchParams({ workspace: owner })
  return (
    <section className="cf-results">
      <h1>Results</h1>
      {workspaces.length > 1 && <form className="cf-result-picker">
        <input type="hidden" name="group" value={group} />
        <label>Workspace<select name="workspace" defaultValue={owner}>
          {workspaces.map(space => <option key={space.id} value={space.id}>
            {space.id === user.id ? 'My workspace' : space.name}
          </option>)}
        </select></label>
        <button>View results</button>
      </form>}
      <dl className="cf-result-metrics" aria-label="All-time workspace results">
        {[
          ['Leads found', integer.format(total.leads)],
          ['Calls booked', integer.format(total.calls)],
          ['Deals won', integer.format(total.won)],
          ['Won revenue', money.format(total.revenue / 100)],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>

      <h2>All-time performance</h2>
      <nav aria-label="Group results" className="cf-result-groups">
        {(['platform', 'search'] as const).map(item =>
          <Link key={item} href={'/app/results?' + workspaceQuery + '&group=' + item}
            aria-current={group === item ? 'page' : undefined}>
            {item === 'platform' ? 'By platform' : 'By saved search'}
          </Link>
        )}
      </nav>
      {results.length ? (
        <div className="cf-result-scroll" role="region" aria-label="Lead performance table" tabIndex={0}>
          <table>
            <caption className="sr-only">All-time results by {group === 'platform' ? 'platform' : 'saved search'}</caption>
            <thead><tr>
              <th scope="col">{group === 'platform' ? 'Platform' : 'Saved search'}</th>
              <th scope="col">Leads</th><th scope="col">Replied</th><th scope="col">Calls booked</th>
              <th scope="col">Won</th><th scope="col">Won USD</th>
              {showCosts && <><th scope="col">Scoring credits</th><th scope="col">Draft credits</th></>}
            </tr></thead>
            <tbody>{results.map(row => {
              const label = group === 'platform'
                ? sources[row.group_id as keyof typeof sources] ?? row.group_id
                : row.search_name
              const filter = new URLSearchParams(workspaceQuery)
              if (row.group_id) filter.set(group === 'platform' ? 'source' : 'service', row.group_id)
              return <tr key={row.group_id ?? 'unattributed'}>
                <th scope="row">{label && row.leads_found > 0
                  ? <Link href={'/app/inbox?' + filter}>{label}</Link>
                  : label ?? 'Unattributed'}</th>
                <td>{integer.format(row.leads_found)}</td><td>{integer.format(row.replies)}</td>
                <td>{integer.format(row.calls)}</td><td>{integer.format(row.wins)}</td>
                <td>{money.format(row.revenue_cents / 100)}</td>
                {showCosts && <><td>{integer.format(row.score_credits ?? 0)}</td>
                  <td>{integer.format(row.reply_credits ?? 0)}</td></>}
              </tr>
            })}</tbody>
          </table>
        </div>
      ) : <section className="panel"><h3>No results yet</h3>
        <p>Your first saved lead{showCosts ? ' or scoring charge' : ''} will appear here.</p>
        <Link href={'/app/inbox?' + workspaceQuery}>Open the lead inbox</Link>
      </section>}
      <details className="cf-result-notes"><summary>How results are counted</summary>
        <p>Replies and calls count each lead once when a teammate marks that stage. Older leads include the stage on record when tracking began. Won revenue uses the current deal value of leads marked won.</p>
        {showCosts && <p>Credits include completed scoring and draft generation, including posts that scored below your minimum. Older charges without a matching platform or saved search appear as Unattributed.</p>}
      </details>
    </section>
  )
}
