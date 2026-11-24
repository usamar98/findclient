'use server'
import { redirect } from 'next/navigation'
import { workspaceProposal } from '@/lib/proposals/data'
import { requireUser } from '@/lib/db/server'

export async function publishFromLead(id: string) {
  const { row, draft } = await workspaceProposal(id)
  if (!row?.share_token) {
    const { db } = await requireUser()
    const { data, error } = await db.rpc('save_lead_proposal', {
      p_lead: id, p_document: draft, p_action: 'publish', p_revision: row?.revision ?? 0,
    })
    if (error) throw new Error('Your proposal could not be published. Open the proposal editor to try again.')
    if (!data) redirect('/app/proposals/' + id + '?changed=1')
  }
  redirect('/app/proposals/' + id + '#published-link')
}
