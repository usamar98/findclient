import Link from 'next/link'
import { Suspense } from 'react'
import { JobActions } from '@/components/workspace/job-actions'
import { getDailyJobs } from '@/lib/daily-jobs'
import { requireUser } from '@/lib/db/server'
import { getJobTracking, jobTrackingProof } from '@/lib/job-tracking'
import { dailyJobSources, isDailyJobSource, researchSourceLabels, researchSourceNotes, type DailyJobSource } from '@/lib/research-catalog'
import type { ResearchSource } from '@/lib/live-research'
import { parseResearchWindow, researchWindows, type ResearchWindow } from '@/lib/research-windows'
import './jobs.css'

export const metadata = { title: '24-hour jobs | Lead To Client' }
export const maxDuration = 60

const perPage = 24
const postedTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
type Filters = { query: string; source?: DailyJobSource; page: number; minutes: ResearchWindow }

function jobsUrl(filters: Filters, page = 1) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.source) params.set('source', filters.source)
  if (filters.minutes !== '1440') params.set('window', filters.minutes)
  if (page > 1) params.set('page', String(page))
  return params.size ? '/app/jobs?' + params : '/app/jobs'
}

function coverageLabel(source: ResearchSource) {
  if (source.status === 'delayed') return 'Source publication delay exceeds this window'
  if (source.status === 'cooldown') return 'Rate limited'
  if (source.status === 'access') return 'Access restricted'
  if (source.status !== 'checked') return 'Unavailable'
  const count = source.count === 1 ? '1 match' : source.count + ' matches'
  if (source.unavailableFeeds?.length) return count + ' saved · Refresh unavailable'
  return source.partial ? count + ' · Partial coverage' : count
}

async function Results({ filters }: { filters: Filters }) {
  const result = await getDailyJobs(filters.query, filters.source, filters.minutes)
  const { sources, posts: jobs } = result
  const pages = Math.max(1, Math.ceil(jobs.length / perPage))
  const page = Math.min(filters.page, pages)
  const visible = jobs.slice((page - 1) * perPage, page * perPage)
  const tracking = await getJobTracking(visible)
  const checked = sources.filter(row => row.status === 'checked' && !row.unavailableFeeds?.length).length

  return <>
    <div className="daily-result-heading">
      <h2>{jobs.length} {jobs.length === 1 ? 'opening' : 'openings'}</h2>
      <span>Checked <time dateTime={result.checkedAt}>{postedTime.format(new Date(result.checkedAt))} UTC</time></span>
    </div>
    <details className="daily-coverage" open={!jobs.length}>
      <summary>Source coverage · {checked} of {sources.length} responded</summary>
      <ul>{sources.map(row => <li key={row.source}>
        <strong>{researchSourceLabels[row.source]}</strong> · {coverageLabel(row)}
        {row.lastCheckedAt && <> · Last source check <time dateTime={row.lastCheckedAt}>{postedTime.format(new Date(row.lastCheckedAt))} UTC</time></>}
        {researchSourceNotes[row.source] && <> · {researchSourceNotes[row.source]}</>}
      </li>)}</ul>
    </details>
    {visible.length ? (
      <ul className="daily-job-list">
        {visible.map(job => <li key={job.url}>
          <article>
            <div className="daily-job-byline">
              <span>{researchSourceLabels[job.source]}{job.author && ' · ' + job.author}</span>
            </div>
            <h3><a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}<span aria-hidden="true"> ↗</span></a></h3>
            <div className="daily-job-times">
              <span>Posted <time dateTime={job.posted_at}>{postedTime.format(new Date(job.posted_at))} UTC</time></span>
              {job.first_found_at
                ? <span>First found <time dateTime={job.first_found_at}>{postedTime.format(new Date(job.first_found_at))} UTC</time></span>
                : <span>First found time unavailable</span>}
            </div>
            {job.compensation && <p className="daily-job-pay">Listed pay · {job.compensation}</p>}
            {job.engagement === 'contract_pay_unlisted' && <p className="daily-job-pay">Contract · Pay not listed</p>}
            {job.excerpt && job.excerpt !== job.title && <p>{job.excerpt}</p>}
            <JobActions job={job} proof={jobTrackingProof(job)} initialTracking={tracking[job.url]} />
          </article>
        </li>)}
      </ul>
    ) : (
      <div className="panel">
        <p>{sources.every(row => row.status === 'delayed')
          ? 'This source releases listings after your selected window. Choose a longer window or another platform.'
          : checked
          ? 'The responding sources returned no matching openings in this publication window.'
          : 'The selected sources could not be checked. Try again later.'}</p>
        {(filters.query || filters.source || filters.minutes !== '1440') && <Link href="/app/jobs">See all jobs from the past 24 hours</Link>}
      </div>
    )}
    {pages > 1 && <nav className="daily-pagination" aria-label="Job pages">
      {page > 1 && <Link href={jobsUrl(filters, page - 1)}>Previous</Link>}
      <span>Page {page} of {pages}</span>
      {page < pages && <Link href={jobsUrl(filters, page + 1)}>Next</Link>}
    </nav>}
  </>
}

export default async function Jobs({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; source?: string | string[]; page?: string | string[]; window?: string | string[] }>
}) {
  await requireUser()
  const { q, source, page, window } = await searchParams
  const filters: Filters = {
    query: typeof q === 'string' ? q.trim().slice(0, 100) : '',
    source: typeof source === 'string' && isDailyJobSource(source) ? source : undefined,
    minutes: parseResearchWindow(window, '1440'),
    page: typeof page === 'string' && /^\d{1,6}$/.test(page) ? Math.max(1, Number(page)) : 1,
  }
  return <div className="daily-jobs">
    <div className="work-title-row"><h1>Jobs from the last 24 hours</h1></div>
    <p>Browse freelance contracts, cash bounties and hiring posts, newest first. Apply on the original listing, then mark the job as applied to track your follow-up.</p>
    <form className="panel daily-filter" action="/app/jobs">
      <label>Search jobs<input type="search" name="q" placeholder="Skill or job title" maxLength={100} defaultValue={filters.query} /></label>
      <label>Posted within<select name="window" defaultValue={filters.minutes}>
        {Object.entries(researchWindows).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Platform<select name="source" defaultValue={filters.source ?? ''}>
        <option value="">All platforms</option>
        {dailyJobSources.map(id => <option key={id} value={id}>{researchSourceLabels[id]}</option>)}
      </select></label>
      <button type="submit">Search jobs</button>
    </form>
    <Suspense key={jobsUrl(filters, filters.page)} fallback={<p role="status">Checking job sources…</p>}>
      <Results filters={filters} />
    </Suspense>
  </div>
}
