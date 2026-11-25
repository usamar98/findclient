'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireLeadAccess } from '@/lib/workspace-access'
import { produceReply } from '@/lib/produce-reply'
import { tones } from '@/lib/niche'
import { allowRequest } from '@/lib/limits'
export async function draftReply(
  idInput: string,
  toneInput: string,
  requestId: string,
) {
  const { db, user, lead, ownerId } = await requireLeadAccess(idInput),
    id = lead.id,
    tone = z.enum(tones).parse(toneInput)
  const request = z.uuid().parse(requestId)
  if (!(await allowRequest('draft:' + user.id, 20, 600)))
    return 'Please wait before generating another draft.'
  const message = await produceReply({ db, lead, ownerId, authorId: user.id, requestId: request, tone })
  if (message) return message
  revalidatePath('/app/leads/' + id)
  revalidatePath('/app')
  revalidatePath('/app/profile')
  revalidatePath('/app/results')
  return null
}
export async function editReply(
  idInput: string,
  leadInput: string,
  solution: string,
  pitch: string,
) {
  const { db, ownerId, lead } = await requireLeadAccess(leadInput),
    id = z.uuid().parse(idInput)
  const content = z.string().trim().min(1).max(16000)
  const { error } = await db
    .from('responses')
    .update({
      solution_md: content.parse(solution),
      pitch_md: content.parse(pitch),
    })
    .eq('id', id)
    .eq('lead_id', lead.id)
    .eq('user_id', ownerId)
    .select('id')
    .single()
  if (error) throw new Error('Update failed')
  revalidatePath('/app/leads/' + lead.id)
}
