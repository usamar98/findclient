'use server'
import { z } from 'zod'
import { requireLeadAccess } from '@/lib/workspace-access'
import { revalidatePath } from 'next/cache'

export async function saveFollowup(id: string, _previous: string, form: FormData) {
  const { db, lead } = await requireLeadAccess(id)
  const text = z.string().trim().min(1).max(10000).safeParse(form.get('draft'))
  if (!text.success) return 'Enter a draft of up to 10,000 characters.'
  const saved = await db.from('proposal_followups').update({ draft: text.data }).eq('lead_id', lead.id)
    .is('cancelled_at', null).not('prepared_at', 'is', null).select('lead_id').maybeSingle()
  if (saved.error || !saved.data) return 'Unable to save. Check whether the follow-up is still open.'
  revalidatePath('/app/proposals/' + lead.id)
  return 'Draft saved.'
}
