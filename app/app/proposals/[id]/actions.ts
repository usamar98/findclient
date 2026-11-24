'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { parseProposalForm } from '@/lib/proposals/form'

export async function changeProposal(id: string, _state: string, form: FormData): Promise<string> {
  const { db } = await requireUser()
  const action = z.enum(['save', 'publish', 'rotate', 'revoke']).safeParse(form.get('action'))
  const revision = z.coerce.number().int().nonnegative().safeParse(form.get('revision'))
  if (!z.uuid().safeParse(id).success || !action.success || !revision.success) return 'Invalid proposal request.'
  const edits = action.data === 'save' || action.data === 'publish'
  const content = edits ? parseProposalForm(form) : null
  if (content && !content.success) {
    const issue = content.error.issues[0]
    return 'Review ' + issue.path.join(' › ') + '. Each package needs a name, scope and timeline. Enter any price in whole units or up to two decimal places.'
  }
  const { data: updated, error } = await db.rpc('save_lead_proposal', {
    p_lead: id, p_document: content?.data ?? null, p_action: action.data, p_revision: revision.data,
  })
  if (error) return 'Your proposal could not be updated. Check your workspace access and try again.'
  if (!updated) return 'Another teammate changed this proposal. Reload the page to review their edits before saving.'
  revalidatePath('/app/proposals/' + id)
  const messages = {
    save: 'Draft saved.',
    publish: 'Published. Your share link is ready.',
    revoke: 'Sharing has been turned off.',
    rotate: 'A new share link is ready. The previous link has expired.',
  }
  return messages[action.data]
}
