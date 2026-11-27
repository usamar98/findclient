import Link from 'next/link'
import { stageNames, statuses } from '@/lib/niche'
import { researchSourceLabels, researchSources } from '@/lib/research-catalog'
import { advancedFiltersActive, type InboxFilters } from '@/lib/inbox-filters'
import { researchWindows } from '@/lib/research-windows'
import { SearchScope } from './search-scope'

type Props = {
  filters: InboxFilters
  clearHref: string
  spaces: { id: string; name: string }[]
  searches: { id: string; user_id: string; skill: string }[]
}

export function LeadFilters({ filters: f, clearHref, spaces, searches }: Props) {
  return (
    <form action="/app/inbox" method="get" className="panel inbox-filters" aria-labelledby="lead-filters-title">
      <div>
        <h2 id="lead-filters-title">{f.view ? 'Search saved history' : 'Filter recent saved leads'}</h2>
        <p className="inbox-filter-help">{f.view ? 'Track saved jobs, applications and follow-ups from any date.' : 'Filter your saved leads by original posting time. Choose Search live to find new jobs on the selected platforms.'}</p>
      </div>
      <div className="inbox-filter-grid">
        <label>Search lead titles<input type="search" name="q" placeholder="e.g. Shopify redesign" defaultValue={f.q} maxLength={100} /></label>
        <SearchScope workspace={f.workspace} service={f.service} spaces={spaces} searches={searches} />
        {f.view ? <input type="hidden" name="view" value="history" /> : <label>Posted within<select name="window" defaultValue={f.window}>
          {Object.entries(researchWindows).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>}
        <label>Sort by<select name="sort" defaultValue={f.sort}>
          <option value="newest">Newest posts</option><option value="score">Highest intent</option>
          <option value="buyer">Highest buyer quality</option><option value="value">Highest deal value</option>
          <option value="followup">Earliest follow-up</option>
        </select></label>
      </div>
      <fieldset className="inbox-checks">
        <legend>Sources <span>Choose any · all are included when empty</span></legend>
        <div>{researchSources.map(id => <label key={id}><input type="checkbox" name="source" value={id} defaultChecked={f.source.includes(id)} />{researchSourceLabels[id]}</label>)}</div>
      </fieldset>
      <details className="inbox-advanced" open={advancedFiltersActive(f)}>
        <summary>Advanced filters</summary>
        <fieldset className="inbox-checks">
          <legend>Pipeline stages</legend>
          <div>{statuses.map(stage => <label key={stage}><input type="checkbox" name="status" value={stage} defaultChecked={f.status.includes(stage)} />{stageNames[stage]}</label>)}</div>
        </fieldset>
        <div className="inbox-filter-grid">
          <label>Application<select name="application" defaultValue={f.application ?? ''}>
            <option value="">All leads</option><option value="applied">Applied jobs only</option>
          </select></label>
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
      <div className="inbox-filter-actions">
        <Link href={clearHref}>Clear filters</Link>
        <button type="submit">Apply filters</button>
        {!f.view && <button type="submit" name="run" value="1">Search live</button>}
      </div>
    </form>
  )
}
