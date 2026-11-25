'use client'
import { useActionState, useState } from 'react'
import { saveFollowup } from './followup-action'

export function FollowupDraft({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [copied, setCopied] = useState('')
  const [message, action, saving] = useActionState(saveFollowup.bind(null, id), '')
  return <form action={action}>
    <label>Follow-up draft<textarea name="draft" rows={4} value={text} onChange={event => setText(event.target.value)} required maxLength={10000} /></label>
    <div className="actions"><button disabled={saving}>Save draft</button><button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setCopied('Draft copied.') }
      catch { setCopied('Select the draft text and copy it.') }
    }}>Copy follow-up</button></div>
    <p role="status">{copied || message}</p>
  </form>
}
