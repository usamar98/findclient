'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  nicheSchema,
  skills,
  sources,
  splitTerms,
  type NicheInput,
} from '@/lib/niche'
import { suggestions, saveNiche } from '@/app/app/niche-actions'
export function NicheEditor({
  initial,
  id,
}: {
  initial?: NicheInput
  id?: string
}) {
  const [step, go] = useState(initial ? 3 : 1),
    [skill, setSkill] = useState(initial?.skill ?? skills[0]),
    [custom, setCustom] = useState(
      !skills.includes(initial?.skill ?? skills[0]),
    )
  const [url, setUrl] = useState(initial?.portfolio_url ?? ''),
    [keywords, setKeywords] = useState(initial?.keywords.join(', ') ?? ''),
    [negative, setNegative] = useState(
      initial?.negative_keywords.join(', ') ?? '',
    )
  const [style, setStyle] = useState(initial?.pitch_style ?? ''),
    [selection, setSelection] = useState<NicheInput['sources']>(
      initial?.sources ?? ['hn', 'shopify', 'reddit'],
    )
  const [subreddits, setSubreddits] = useState(initial?.subreddits?.join(', ') ?? '')
  const [threads, setThreads] = useState(initial?.hn_threads?.join(', ') ?? '')
  const [score, setScore] = useState(initial?.min_intent ?? 65),
    [active, setActive] = useState(initial?.active ?? true),
    [notice, setNotice] = useState(''),
    [busy, start] = useTransition()
  const router = useRouter()
  function next() {
    if (step === 1) {
      go(2)
      return
    }
    if (step === 2) {
      start(async () => {
        setNotice('')
        try {
          const s = await suggestions(skill, url)
          setKeywords(s.keywords.join(', '))
          setNegative(s.negative_keywords.join(', '))
          setStyle(s.pitch_style)
        } catch {
          setNotice(
            'Suggestions are unavailable. Enter your own keywords below.',
          )
          if (!keywords) setKeywords(skill)
        }
        go(3)
      })
      return
    }
    const parsed = nicheSchema.safeParse({
      skill,
      portfolio_url: url,
      keywords: splitTerms(keywords),
      negative_keywords: splitTerms(negative),
      subreddits: splitTerms(subreddits),
      hn_threads: splitTerms(threads),
      pitch_style: style,
      sources: selection,
      min_intent: score,
      active,
    })
    if (!parsed.success) {
      setNotice(parsed.error.issues[0].message)
      return
    }
    start(async () => {
      try {
        const result = await saveNiche(parsed.data, id)
        if (result.error) {
          setNotice(result.error)
          return
        }
        router.push(id ? '/app/settings' : '/app')
        router.refresh()
      } catch {
        setNotice('Unable to save. Please try again.')
      }
    })
  }
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        next()
      }}
    >
      <p>Step {step} of 3</p>
      {step === 1 && (
        <>
          <h2>What work do you want to find?</h2>
          <label>
            Skill
            <select
              value={custom ? 'custom' : skill}
              onChange={(e) => {
                const value = e.target.value
                setCustom(value === 'custom')
                setSkill(value === 'custom' ? '' : value)
              }}
            >
              {skills.map((s) => (
                <option key={s}>{s}</option>
              ))}
              <option value="custom">Custom skill</option>
            </select>
          </label>
          {custom && (
            <label>
              Your skill
              <input
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <h2>Which work should shape your pitch?</h2>
          <p>
            Add a public portfolio to suggest search phrases and a writing
            style. Lead To Client sends the URL to Jina Reader and an excerpt to its
            AI provider.
          </p>
          <label>
            Portfolio URL (optional)
            <input
              type="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={300}
            />
          </label>
        </>
      )}
      {step === 3 && (
        <>
          <h2>Which requests should reach your inbox?</h2>
          <p>{skill}</p>
          <label>
            Keywords, separated by commas
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              required
            />
          </label>
          <label>
            Exclude these phrases
            <textarea
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
            />
          </label>
          <label>
            Pitch style
            <textarea
              maxLength={800}
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Search sources</legend>
            {(Object.keys(sources) as NicheInput['sources']).map((k) => (
              <label key={k} className="check">
                <input
                  type="checkbox"
                  checked={selection.includes(k)}
                  onChange={(e) =>
                    setSelection(
                      e.target.checked
                        ? [...selection, k]
                        : selection.filter((x) => x !== k),
                    )
                  }
                />
                {sources[k]}
              </label>
            ))}
          </fieldset>
          {selection.includes('reddit') && <label>Watch specific subreddits (optional)
            <input value={subreddits} onChange={e => setSubreddits(e.target.value)}
              placeholder="r/webflow, r/smallbusiness" maxLength={1000} />
            <small>Limit indexed Reddit searches to up to 10 communities, separated by commas.</small>
          </label>}
          {selection.includes('hn') && <label>Watch Hacker News hiring threads (optional)
            <textarea value={threads} onChange={e => setThreads(e.target.value)}
              placeholder="Paste a thread’s news.ycombinator.com/item link or ID" maxLength={2400} />
            <small>Search matching comments in up to 10 threads. Separate links or IDs with commas.</small>
          </label>}
          <label>
            Minimum intent score
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Enable scheduled searches for this niche
          </label>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="actions">
        {step > 1 && (
          <button type="button" disabled={busy} onClick={() => go(step - 1)}>
            Back
          </button>
        )}
        <button disabled={busy}>
          {busy
            ? 'Working…'
            : step === 1
              ? 'Continue'
              : step === 2
                ? 'Suggest keywords'
                : 'Save niche'}
        </button>
      </div>
    </form>
  )
}
