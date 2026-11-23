'use client'
import { useState, useTransition } from 'react'
import { draftReply, editReply } from '@/app/app/leads/actions'
import { tones } from '@/lib/niche'
type Draft = { id: string; solution_md: string; pitch_md: string; tone: string }
function Editor({ draft, lead }: { draft: Draft; lead: string }) {
  const [solution, setSolution] = useState(draft.solution_md),
    [pitch, setPitch] = useState(draft.pitch_md),
    [message, setMessage] = useState(''),
    [busy, start] = useTransition()
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s)
      setMessage('Copied to clipboard.')
    } catch {
      setMessage('Select the text and copy it manually.')
    }
  }
  return (
    <article>
      <p>{draft.tone} draft</p>
      <label>
        Helpful solution
        <textarea
          rows={8}
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          maxLength={16000}
        />
      </label>
      <button onClick={() => copy(solution)}>Copy solution</button>
      <label>
        Personal pitch
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={16000}
        />
      </label>
      <div className="actions">
        <button onClick={() => copy(pitch)}>Copy pitch</button>
        <button
          disabled={busy}
          onClick={() =>
            start(async () => {
              try {
                await editReply(draft.id, lead, solution, pitch)
                setMessage('Edits saved.')
              } catch {
                setMessage('Could not save. Please check both fields.')
              }
            })
          }
        >
          Save edits
        </button>
      </div>
      <p role="status">{message}</p>
    </article>
  )
}
export function Drafts({ lead, drafts }: { lead: string; drafts: Draft[] }) {
  const [tone, setTone] = useState('friendly'),
    [busy, start] = useTransition(),
    [notice, setNotice] = useState('')
  return (
    <>
      <h2>Solution and pitch</h2>
      <p>Review and edit your draft before posting it yourself.</p>
      <label>
        Tone
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          {tones.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              setNotice(
                (await draftReply(lead, tone, crypto.randomUUID())) ??
                  'Draft ready.',
              )
            } catch {
              setNotice('Could not generate a draft.')
            }
          })
        }
      >
        {busy
          ? 'Writing…'
          : drafts.length
            ? 'Regenerate · 1 credit'
            : 'Generate solution · 1 credit'}
      </button>
      <p role="status">{notice}</p>
      {drafts.map((d) => (
        <Editor key={d.id} draft={d} lead={lead} />
      ))}
    </>
  )
}
