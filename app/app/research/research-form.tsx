'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { isPaidSource, keylessSources, researchSourceLabels, researchSourceNotes, researchSources, researchWindows, type ResearchPost, type ResearchState, type ResearchStatus, type ResearchWindow } from '@/lib/live-research'
import { findFreshPosts } from './actions'

const messages: Record<Exclude<ResearchStatus, 'checked'>, string> = {
  unconfigured: 'Search provider not configured', access: 'Provider denied access',
  cooldown: 'Provider rate limit', unavailable: 'Source unavailable', limit: 'Daily search limit reached',
}
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

function Runtime({ ms }: { ms: number }) {
  return <time className="research-runtime" dateTime={`PT${ms / 1000}S`}>
    {ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`}
  </time>
}

function RunningTimer() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((performance.now() - start) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <span role="timer" aria-label="Elapsed search time" className="research-runtime">{seconds} s elapsed</span>
}

function submitSearch(_previous: ResearchState, form: FormData) {
  // Keep previously rendered listings in the browser when running the next search.
  return findFreshPosts({}, form)
}

function PostCard({ post, checkedAt }: { post: ResearchPost; checkedAt: string }) {
  const age = Math.floor((Date.parse(checkedAt) - Date.parse(post.posted_at)) / 60000)
  const ageLabel = age < 1 ? 'Under 1 minute' : age < 60 ? age + (age === 1 ? ' minute' : ' minutes') : Math.floor(age / 60) + (age < 120 ? ' hour' : ' hours')
  const kind = { hiring: 'Hiring request', help: 'Help request', topic: 'Discussion' }[post.kind]
  const board = researchSourceLabels[post.source]
  return <article className="panel research-post">
    <p>{post.engagement === 'paid_freelance'
      ? <><strong className="research-paid">Paid freelance job</strong> · <a href={post.url} target="_blank" rel="noopener noreferrer">View on {board}</a></>
      : <>{kind} · {board}</>}{post.author && <> · {post.author}</>}</p>
    <h3><a href={post.url} target="_blank" rel="noopener noreferrer">{post.title}<span aria-hidden="true"> ↗</span></a></h3>
    {post.engagement === 'paid_freelance' && post.compensation && <p className="research-pay">Listed pay · {post.compensation}</p>}
    {post.excerpt && post.excerpt !== post.title && <blockquote>{post.excerpt}</blockquote>}
    <time dateTime={post.posted_at}>{timestamp.format(new Date(post.posted_at))} UTC · {ageLabel} old when checked</time>
    {post.source === 'stackexchange' && <small><a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></small>}
  </article>
}

export function ResearchForm({ initialQuery, initialSources, initialWindow }: { initialQuery: string; initialSources: ResearchPost['source'][]; initialWindow: ResearchWindow }) {
  const [q, setQuery] = useState(initialQuery)
  const [selected, setSelected] = useState(initialSources)
  const [minutes, setMinutes] = useState<ResearchWindow>(initialWindow)
  const [watch, setWatch] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [state, submit, pending] = useActionState<ResearchState, FormData>(submitSearch, {})
  const paidOnly = selected.length > 0 && selected.every(isPaidSource)
  const snapshot = state.result
  const result = snapshot && snapshot.query === q.trim() && snapshot.minutes === minutes &&
    snapshot.sources.length === selected.length && snapshot.sources.every(s => selected.includes(s.source)) ? snapshot : undefined
  const checked = result?.sources.filter(source => source.status === 'checked').length ?? 0
  const reviewed = result?.sources.reduce((sum, source) => sum + source.reviewed, 0) ?? 0
  const requests = result?.posts.filter(post => post.kind !== 'topic') ?? []
  const discussions = result?.posts.filter(post => post.kind === 'topic') ?? []
  const canWatch = Boolean(result && checked && (minutes === '1' || minutes === '15') && selected.every(id => keylessSources.includes(id)))

  useEffect(() => {
    if (!watch || !canWatch || pending) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') formRef.current?.requestSubmit()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [watch, canWatch, pending, result?.checkedAt])

  return <>
    <form ref={formRef} action={submit} className="panel research-form" onChange={() => setWatch(false)}>
      <div className="research-inputs">
        <label>Keywords{paidOnly && ' (optional)'}<input type="search" name="q" minLength={2} maxLength={100} required={!paidOnly} placeholder={paidOnly ? 'All paid freelance jobs' : 'e.g. Shopify developer'} value={q} onChange={e => setQuery(e.target.value)} aria-describedby={paidOnly ? 'paid-search-hint' : undefined} /></label>
        <label>Posted within<select name="window" value={minutes} onChange={e => setMinutes(e.target.value as ResearchWindow)}>
          {Object.entries(researchWindows).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <fieldset><legend>Platforms</legend>
        <div className="research-platforms">{researchSources.map(id => <label key={id}>
          <input type="checkbox" name="source" value={id} checked={selected.includes(id)} onChange={e =>
            setSelected(e.target.checked ? [...selected, id] : selected.filter(s => s !== id))} />{researchSourceLabels[id]}
        </label>)}</div>
      </fieldset>
      {paidOnly && <p id="paid-search-hint">Leave keywords empty to browse all paid freelance jobs in this time window.</p>}
      <p>Post age uses the platform’s publication time. Feeds can take longer to show new listings. Live searches use no scoring credits.</p>
      <div className="research-submit">
        <button disabled={!selected.length || pending} type="submit">{pending ? 'Checking platforms…' : 'Search posts'}</button>
        {pending && <RunningTimer />}
      </div>
      {!selected.length && <p role="status">Choose at least one platform.</p>}
    </form>
    {state.error && <p role="alert">{state.error}</p>}
    {snapshot && !result && !pending && <p role="status">Your search settings changed. Select <strong>Search posts</strong> to check the new selection.</p>}
    {result && <section aria-labelledby="research-results">
      <h2 id="research-results" aria-live="polite">{requests.length} {paidOnly ? `paid freelance opening${requests.length === 1 ? '' : 's'}` : requests.length === 1 ? 'request' : 'requests'}{result.query && <> for “{result.query}”</>}</h2>
      <p>{researchWindows[result.minutes]} · Checked <time dateTime={result.checkedAt}>{timestamp.format(new Date(result.checkedAt))} UTC</time>
        {result.durationMs != null && <> · Search runtime <Runtime ms={result.durationMs} /></>}</p>
      {canWatch && <label className="research-watch"><input type="checkbox" checked={watch} onChange={e => setWatch(e.target.checked)} />Check again every minute while this tab is visible</label>}
      <details className="research-coverage" open={!requests.length}>
        <summary>Platform coverage · {reviewed} {reviewed === 1 ? 'fresh post' : 'fresh posts'} checked</summary>
        <ul className="research-sources" aria-label="Platform coverage">
        {result.sources.map(source => <li key={source.source}><strong>{researchSourceLabels[source.source]}</strong> · {source.indexed ? 'Search index' : 'API or feed'} · {source.status === 'checked' ? source.reviewed + ' checked, ' + source.requests + (source.requests === 1 ? ' request' : ' requests') : messages[source.status]}
          {source.durationMs != null && <> · <Runtime ms={source.durationMs} /></>}
          {source.partial && <> · Partial coverage</>}
          {!!source.checkedFeeds?.length && <> · Checked {source.checkedFeeds.join(', ')}</>}
          {!!source.unavailableFeeds?.length && <> · Unavailable: {source.unavailableFeeds.join(', ')}</>}
          {researchSourceNotes[source.source] && <small className="research-coverage-note">{researchSourceNotes[source.source]}</small>}
        </li>)}
        </ul>
      </details>
      {!requests.length && <div className="panel"><p>{!checked
        ? 'The selected platforms could not complete this search. See platform coverage for the reason.'
        : paidOnly ? 'The responding platforms returned no matching paid freelance openings published in this window.'
        : reviewed ? 'The fresh posts reviewed contained no matching request for help or hiring.'
        : 'The responding sources returned no candidate posts published in this window.'}</p></div>}
      {requests.map(post => <PostCard key={post.url} post={post} checkedAt={result.checkedAt} />)}
      {!!discussions.length && <details className="research-discussions">
        <summary>Related discussions ({discussions.length})</summary>
        {discussions.map(post => <PostCard key={post.url} post={post} checkedAt={result.checkedAt} />)}
      </details>}
    </section>}
  </>
}
