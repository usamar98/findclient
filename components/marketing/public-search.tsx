'use client'
import { useState, useTransition } from 'react'
import { publicSearch } from '@/app/(public)/tools/actions'
type Hit = {
  title: string
  body: string
  url: string
  source: string
  posted_at: string
  author?: string
}
export function PublicSearch({
  redditOnly = false,
  initial = [],
  initialLabel = '',
}: {
  redditOnly?: boolean
  initial?: readonly Hit[]
  initialLabel?: string
}) {
  const [term, setTerm] = useState('Shopify'),
    [hits, setHits] = useState<readonly Hit[]>(initial),
    [label, setLabel] = useState(initialLabel),
    [busy, start] = useTransition()
  return (
    <div className="public-search">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            try {
              const result = await publicSearch(term, redditOnly)
              setHits(result.hits)
              setLabel(result.mode)
            } catch {
              setHits([])
              setLabel('Search is unavailable. Please try again.')
            }
          })
        }}
      >
        <label>
          Skill or problem
          <input
            required
            minLength={2}
            maxLength={80}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Shopify theme development"
          />
        </label>
        <button disabled={busy}>{busy ? 'Searching…' : 'Find requests'}</button>
      </form>
      <p aria-live="polite">{label}</p>
      {hits.length > 0 ? (
        <ul>
          {hits.map((hit) => (
            <li key={hit.url}>
              <small>
                {hit.source === 'stackexchange' ? 'Stack Overflow' : hit.source}
                {hit.author ? ' · ' + hit.author : ''} ·{' '}
                <time dateTime={hit.posted_at}>
                  {hit.posted_at.slice(0, 10)}
                </time>
              </small>
              <h3>
                <a href={hit.url} target="_blank" rel="noopener noreferrer">
                  {hit.title}
                </a>
              </h3>
              <p>{hit.body}</p>
              {hit.source === 'stackexchange' && (
                <small>
                  Excerpt · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
                </small>
              )}
            </li>
          ))}
        </ul>
      ) : (
        label && <p>Try a broader skill or a shorter phrase.</p>
      )}
    </div>
  )
}
