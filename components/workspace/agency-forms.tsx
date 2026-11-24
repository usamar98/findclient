'use client'

import { useActionState } from 'react'
import { inviteMember, savePipeline } from '@/app/app/agency-actions'
import { stageNames, statuses } from '@/lib/niche'
import type { LeadCrm, WorkspacePerson } from '@/lib/workspace-types'

export function TeamInviteForm() {
  const [message, action, busy] = useActionState(inviteMember, '')
  return <form action={action}>
    <label>Teammate email<input name="email" type="email" autoComplete="off" required maxLength={254} /></label>
    <button disabled={busy}>{busy ? 'Inviting…' : 'Invite teammate'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}

export function PipelineForm({ lead, people }: {
  lead: LeadCrm & { id: string; status: (typeof statuses)[number] }
  people: WorkspacePerson[]
}) {
  const [message, action, busy] = useActionState(savePipeline.bind(null, lead.id), '')
  return <form action={action}>
    <div className="filters" key={lead.crm_version}>
      <input type="hidden" name="version" value={lead.crm_version} />
      <label>Stage<select name="status" defaultValue={lead.status}>
        {statuses.map(s => <option key={s} value={s}>{stageNames[s]}</option>)}
      </select></label>
      <label>Assigned to<select name="assignee" defaultValue={lead.assignee_id ?? ''}>
        <option value="">Unassigned</option>
        {people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
      </select></label>
      <label>Deal value (USD)<input type="number" name="amount" inputMode="decimal" min="0" max="999999999.99" step="0.01" defaultValue={(lead.deal_value_cents / 100).toFixed(2)} /></label>
      <label>Follow up on<input name="date" type="date" defaultValue={lead.follow_up_on ?? ''} /></label>
    </div>
    <p className="meta">We email the assignee at 09:00 UTC on the follow-up date. Unassigned reminders go to the workspace owner.</p>
    <button disabled={busy}>{busy ? 'Saving…' : 'Save pipeline'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}
