'use client'
import { useState, useTransition } from 'react'
import { freeDraft } from '@/app/(public)/tools/actions'
export function FreeWriter({
  tool,
}: {
  tool: 'proposal-generator' | 'client-pitch-writer'
}) {
  const [text, setText] = useState(''),
    [notice, setNotice] = useState(''),
    [pending, start] = useTransition()
  return (
    <div className="free-writer">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          start(async () => {
            try {
              const result = await freeDraft({
                ...Object.fromEntries(data),
                tool,
              })
              setText(result.text)
              setNotice(result.label)
            } catch {
              setNotice('Check the input fields and try again.')
            }
          })
        }}
      >
        <label>
          What did the requester ask for?
          <textarea
            name="problem"
            required
            minLength={12}
            maxLength={2200}
            placeholder="Paste the public request, without private contact details."
          />
        </label>
        <label>
          Your first deliverable
          <input
            name="deliverable"
            required
            minLength={3}
            maxLength={240}
            placeholder="A working variant image switcher"
          />
        </label>
        <label>
          How will they verify it?
          <input
            name="check"
            required
            minLength={3}
            maxLength={240}
            placeholder="Each selected variant shows its assigned image on mobile"
          />
        </label>
        <label>
          Tone
          <select name="tone">
            <option value="friendly">Friendly</option>
            <option value="expert">Expert</option>
            <option value="short">Short</option>
          </select>
        </label>
        <button disabled={pending}>
          {pending
            ? 'Writing…'
            : tool === 'proposal-generator'
              ? 'Write proposal'
              : 'Write pitch'}
        </button>
      </form>
      <p role="status">{notice}</p>
      {text && (
        <>
          <label>
            Your editable draft
            <textarea
              value={text}
              rows={9}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                setNotice('Copied to clipboard.')
              } catch {
                setNotice('Select your draft to copy it manually.')
              }
            }}
          >
            Copy draft
          </button>
        </>
      )}
    </div>
  )
}
