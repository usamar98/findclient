import Link from 'next/link'
import { sources, stageNames, statuses } from '@/lib/niche'
import { advancedFiltersActive, sourceIds, type InboxFilters } from '@/lib/inbox-filters'
import { SearchScope } from './search-scope'

type Props = {
  filters: InboxFilters
  spaces: { id: string; name: string }[]
  searches: { id: string; user_id: string; skill: string }[]
}

export function LeadFilters({ filters: f, spaces, searches }: Props) {
  return (
    <form action="/app/inbox" method="get" className="panel inbox-filters" aria-labelledby="lead-filters-title">
      <h2 id="lead-filters-title">Filter leads</h2>
      <div className="inbox-filter-grid">
        <label>Search lead titles<input type="search" name="q" placeholder="e.g. Shopify redesign" defaultValue={f.q} maxLength={100} /></label>
        <SearchScope workspace={f.workspace} service={f.service} spaces={spaces} searches={searches} />
        <label>Posted within<select name="days" defaultValue={f.days ?? ''}>
          <option value="">Any time</option><option value="1">Past 24 hours</option>
          {[3, 7, 30].map(days => <option key={days} value={days}>Past {days} days</option>)}
        </select></label>
        <label>Sort by<select name="sort" defaultValue={f.sort}>
          <option value="newest">Newest posts</option><option value="score">Highest intent</option>
          <option value="buyer">Highest buyer quality</option><option value="value">Highest deal value</option>
          <option value="followup">Earliest follow-up</option>
        </select></label>
      </div>
      <fieldset className="inbox-checks">
        <legend>Sources <span>Choose any · all are included when empty</span></legend>
        <div>{sourceIds.map(id => <label key={id}><input type="checkbox" name="source" value={id} defaultChecked={f.source.includes(id)} />{sources[id]}</label>)}</div>
      </fieldset>
      <details className="inbox-advanced" open={advancedFiltersActive(f)}>
        <summary>Advanced filters</summary>
        <fieldset className="inbox-checks">
          <legend>Pipeline stages</legend>
          <div>{statuses.map(stage => <label key={stage}><input type="checkbox" name="status" value={stage} defaultChecked={f.status.includes(stage)} />{stageNames[stage]}</label>)}</div>
        </fieldset>
        <div className="inbox-filter-grid">
          <label>Assigned to<select name="assigned" defaultValue={f.assigned ?? ''}>
            <option value="">Anyone</option><option value="me">Me</option><option value="unassigned">Unassigned</option>
          </select></label>
          <label>Follow-up<select name="due" defaultValue={f.due ?? ''}>
            <option value="">Any date</option><option value="yes">Due today or overdue</option>
            <option value="next7">Next 7 days</option><option value="none">No follow-up set</option>
          </select></label>
          <label>Minimum intent score<input type="number" name="score" min="0" max="100" placeholder="0–100" defaultValue={f.score || ''} /></label>
          <label>Minimum buyer quality<input type="number" name="quality" min="0" max="100" placeholder="0–100" defaultValue={f.quality || ''} /></label>
          <label>Minimum deal value (USD)<input type="number" name="value" min="0" max="21474836.47" step="0.01" placeholder="0.00" defaultValue={f.value || ''} /></label>
        </div>
      </details>
      <div className="inbox-filter-actions"><Link href="/app/inbox">Clear filters</Link><button type="submit">Apply filters</button></div>
    </form>
  )
}
