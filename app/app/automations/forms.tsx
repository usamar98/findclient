'use client'
import { useActionState } from 'react'
import { sources } from '@/lib/niche'
import type { LeadRule } from '@/lib/workflow-schema'
import { saveRule, saveSequence } from './actions'

type Choice = { id: string; name: string }
export function RuleForm({ rule, searches, people, telegram }: {
  rule?: LeadRule; searches: Choice[]; people: Choice[]; telegram: boolean
}) {
  const [message, action, pending] = useActionState(saveRule, '')
  return <form action={action} className="workflow-form">
    <input type="hidden" name="id" value={rule?.id ?? ''} />
    <label>Rule name<input name="name" required maxLength={80} defaultValue={rule?.name} placeholder="High-intent store projects" /></label>
    <fieldset><legend>When a new lead matches</legend>
      <label>Saved search<select name="niche_id" defaultValue={rule?.niche_id ?? ''}>
        <option value="">Any saved search</option>
        {searches.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select></label>
      <label>Platform<select name="source" defaultValue={rule?.source ?? ''}>
        <option value="">Any platform</option>
        {Object.entries(sources).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>Minimum intent score<input type="number" name="min_score" min="0" max="100" required defaultValue={rule?.min_score ?? 85} /></label>
      <label className="check"><input type="checkbox" name="require_budget" defaultChecked={rule?.require_budget} />Require evidence of a paid budget</label>
    </fieldset>
    <fieldset><legend>Take these actions</legend>
      <label>Assign to<select name="assignee_id" defaultValue={rule?.assignee_id ?? ''}>
        <option value="">Keep current assignment</option>
        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label className="check"><input type="checkbox" name="draft_reply" defaultChecked={rule?.draft_reply} />Prepare a reply for review · 1 credit</label>
      <label className="check"><input type="checkbox" name="telegram" disabled={!telegram} defaultChecked={telegram && rule?.telegram} />Alert me on Telegram</label>
      {!telegram && <a href="/app/settings#telegram-alerts">Connect Telegram in Settings</a>}
    </fieldset>
    <label className="check"><input type="checkbox" name="enabled" defaultChecked={rule?.enabled ?? true} />Run for new leads</label>
    <button disabled={pending}>{pending ? 'Saving…' : 'Save rule'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}

export function SequenceForm({ enabled, days }: { enabled: boolean; days: number }) {
  const [message, action, pending] = useActionState(saveSequence, '')
  return <form action={action} className="workflow-form">
    <label className="check"><input type="checkbox" name="enabled" defaultChecked={enabled} />Email me on the first proposal visit and prepare a follow-up draft</label>
    <label>Days after first visit<input type="number" name="days" min="1" max="30" required defaultValue={days} /></label>
    <p className="meta">The draft appears in the proposal for review. Booking a call, closing the deal, or revoking its link stops the sequence. Turning this off cancels pending follow-ups.</p>
    <button disabled={pending}>Save follow-up settings</button>
    {message && <p role="status">{message}</p>}
  </form>
}
