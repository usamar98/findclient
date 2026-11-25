'use client'
import { useActionState, useState } from 'react'
import { sources } from '@/lib/niche'
import { researchSources, researchWindows, type ResearchState, type ResearchStatus, type ResearchWindow } from '@/lib/live-research'
import type { SourceId } from '@/lib/sources/shared'
import { findFreshPosts } from './actions'

const messages: Record<Exclude<ResearchStatus, 'checked'>, string> = {
  unconfigured: 'Search provider not configured', access: 'Provider denied access',
  cooldown: 'Provider rate limit', unavailable: 'Source unavailable', limit: 'Daily search limit reached',
}
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

export function ResearchForm({ initialQuery, initialSources }: { initialQuery: string; initialSources: SourceId[] }) {
  const [q, setQuery] = useState(initialQuery)
  const [selected, setSelected] = useState(initialSources)
  const [window, setWindow] = useState<ResearchWindow>('60')
  const [state, submit, pending] = useActionState<ResearchState, FormData>(findFreshPosts, {})
  const result = state.result
  const checked = result?.sources.filter(source => source.status === 'checked').length ?? 0
  return <>
    <form action={submit} className="panel research-form">
      <div className="research-inputs">
        <label>Keywords<input type="search" name="q" minLength={2} maxLength={100} required placeholder="e.g. Shopify developer" value={q} onChange={e => setQuery(e.target.value)} /></label>
        <label>Posted within<select name="window" value={window} onChange={e => setWindow(e.target.value as ResearchWindow)}>
          {Object.entries(researchWindows).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <fieldset><legend>Platforms</legend>
        <div className="research-platforms">{researchSources.map(id => <label key={id}>
          <input type="checkbox" name="source" value={id} checked={selected.includes(id)} onChange={e =>
            setSelected(e.target.checked ? [...selected, id] : selected.filter(s => s !== id))} />{sources[id]}
        </label>)}</div>
      </fieldset>
      <p>Indexed sources can take longer to show new posts. Results include an original link and publication time. Searching here uses no scoring credits.</p>
      <button disabled={!selected.length || pending} type="submit">{pending ? 'Checking platforms…' : 'Search posts'}</button>
      {!selected.length && <p role="status">Choose at least one platform.</p>}
    </form>
    {state.error && <p role="alert">{state.error}</p>}
    {result && <section aria-labelledby="research-results">
      <h2 id="research-results" aria-live="polite">{result.posts.length} {result.posts.length === 1 ? 'post' : 'posts'} for “{result.query}”</h2>
      <p>{researchWindows[result.minutes]} · Checked <time dateTime={result.checkedAt}>{timestamp.format(new Date(result.checkedAt))} UTC</time></p>
      <ul className="research-sources" aria-label="Platform coverage">
        {result.sources.map(source => <li key={source.source}><strong>{sources[source.source]}</strong> · {source.indexed ? 'Search index' : 'API or feed'} · {source.status === 'checked' ? source.count + (source.count === 1 ? ' post' : ' posts') : messages[source.status]}
          {!!source.checkedFeeds?.length && <> · Checked {source.checkedFeeds.join(', ')}</>}
          {!!source.unavailableFeeds?.length && <> · Unavailable: {source.unavailableFeeds.join(', ')}</>}
        </li>)}
      </ul>
      {!result.posts.length && <div className="panel"><p>{checked
        ? 'The responding platforms returned no posts with a precise publication time in this window. Try a longer window or a different phrase.'
        : 'None of the selected platforms could complete this search. Check the platform statuses above.'}</p></div>}
      {result.posts.map(post => {
        const age = Math.floor((Date.parse(result.checkedAt) - Date.parse(post.posted_at)) / 60000)
        const ageLabel = age < 1 ? 'Under 1 minute old' : age < 60 ? age + (age === 1 ? ' minute old' : ' minutes old') : Math.floor(age / 60) + (age < 120 ? ' hour old' : ' hours old')
        return <article className="panel research-post" key={post.url}>
          <p>{sources[post.source]}{post.author && <> · {post.author}</>} · {ageLabel} at search time</p>
          <h3><a href={post.url} target="_blank" rel="noopener noreferrer">{post.title}<span aria-hidden="true"> ↗</span></a></h3>
          {post.excerpt && post.excerpt !== post.title && <p>{post.excerpt}</p>}
          <time dateTime={post.posted_at}>{timestamp.format(new Date(post.posted_at))} UTC</time>
          {post.source === 'stackexchange' && <small><a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></small>}
        </article>
      })}
    </section>}
  </>
}
