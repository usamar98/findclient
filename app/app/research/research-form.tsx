'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { sources } from '@/lib/niche'
import { keylessSources, researchSources, researchWindows, type ResearchPost, type ResearchState, type ResearchStatus, type ResearchWindow } from '@/lib/live-research'
import type { SourceId } from '@/lib/sources/shared'
import { findFreshPosts } from './actions'

const messages: Record<Exclude<ResearchStatus, 'checked'>, string> = {
  unconfigured: 'Search provider not configured', access: 'Provider denied access',
  cooldown: 'Provider rate limit', unavailable: 'Source unavailable', limit: 'Daily search limit reached',
}
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

function PostCard({ post, checkedAt }: { post: ResearchPost; checkedAt: string }) {
  const age = Math.floor((Date.parse(checkedAt) - Date.parse(post.posted_at)) / 60000)
  const ageLabel = age < 1 ? 'Under 1 minute' : age < 60 ? age + (age === 1 ? ' minute' : ' minutes') : Math.floor(age / 60) + (age < 120 ? ' hour' : ' hours')
  const kind = { hiring: 'Hiring request', help: 'Help request', topic: 'Discussion' }[post.kind]
  return <article className="panel research-post">
    <p>{kind} · {sources[post.source]}{post.author && <> · {post.author}</>}</p>
    <h3><a href={post.url} target="_blank" rel="noopener noreferrer">{post.title}<span aria-hidden="true"> ↗</span></a></h3>
    {post.excerpt && post.excerpt !== post.title && <blockquote>{post.excerpt}</blockquote>}
    <time dateTime={post.posted_at}>{timestamp.format(new Date(post.posted_at))} UTC · {ageLabel} old when checked</time>
    {post.source === 'stackexchange' && <small><a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></small>}
  </article>
}

export function ResearchForm({ initialQuery, initialSources }: { initialQuery: string; initialSources: SourceId[] }) {
  const [q, setQuery] = useState(initialQuery)
  const [selected, setSelected] = useState(initialSources)
  const [minutes, setMinutes] = useState<ResearchWindow>('15')
  const [watch, setWatch] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [state, submit, pending] = useActionState<ResearchState, FormData>(findFreshPosts, {})
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
        <label>Keywords<input type="search" name="q" minLength={2} maxLength={100} required placeholder="e.g. Shopify developer" value={q} onChange={e => setQuery(e.target.value)} /></label>
        <label>Posted within<select name="window" value={minutes} onChange={e => setMinutes(e.target.value as ResearchWindow)}>
          {Object.entries(researchWindows).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <fieldset><legend>Platforms</legend>
        <div className="research-platforms">{researchSources.map(id => <label key={id}>
          <input type="checkbox" name="source" value={id} checked={selected.includes(id)} onChange={e =>
            setSelected(e.target.checked ? [...selected, id] : selected.filter(s => s !== id))} />{sources[id]}
        </label>)}</div>
        <div className="research-presets">
          <button type="button" onClick={() => { setWatch(false); setSelected(keylessSources) }}>Select platforms with no key required</button>
          <button type="button" onClick={() => { setWatch(false); setSelected(researchSources) }}>Select all platforms</button>
        </div>
      </fieldset>
      <p>Hacker News, Bluesky, Stack Overflow, Shopify Community and Public forums work without API keys. Searching uses no scoring credits.</p>
      <button disabled={!selected.length || pending} type="submit">{pending ? 'Checking platforms…' : 'Search posts'}</button>
      {!selected.length && <p role="status">Choose at least one platform.</p>}
    </form>
    {state.error && <p role="alert">{state.error}</p>}
    {snapshot && !result && !pending && <p role="status">Your search settings changed. Select <strong>Search posts</strong> to check the new selection.</p>}
    {result && <section aria-labelledby="research-results">
      <h2 id="research-results" aria-live="polite">{requests.length} {requests.length === 1 ? 'request' : 'requests'} for “{result.query}”</h2>
      <p>{researchWindows[result.minutes]} · Checked <time dateTime={result.checkedAt}>{timestamp.format(new Date(result.checkedAt))} UTC</time></p>
      {canWatch && <label className="research-watch"><input type="checkbox" checked={watch} onChange={e => setWatch(e.target.checked)} />Check again every minute while this tab is visible</label>}
      <details className="research-coverage" open={!requests.length}>
        <summary>Platform coverage · {reviewed} {reviewed === 1 ? 'fresh post' : 'fresh posts'} checked</summary>
        <ul className="research-sources" aria-label="Platform coverage">
        {result.sources.map(source => <li key={source.source}><strong>{sources[source.source]}</strong> · {source.indexed ? 'Search index' : 'API or feed'} · {source.status === 'checked' ? source.reviewed + ' checked, ' + source.requests + (source.requests === 1 ? ' request' : ' requests') : messages[source.status]}
          {source.partial && <> · Partial coverage</>}
          {!!source.checkedFeeds?.length && <> · Checked {source.checkedFeeds.join(', ')}</>}
          {!!source.unavailableFeeds?.length && <> · Unavailable: {source.unavailableFeeds.join(', ')}</>}
        </li>)}
        </ul>
      </details>
      {!requests.length && <div className="panel"><p>{!checked
        ? 'The selected platforms could not complete this search. See platform coverage for the reason.'
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
