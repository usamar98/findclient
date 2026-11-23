'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { generateReply } from '@/lib/ai'
import { statuses, tones } from '@/lib/niche'
import { allowRequest } from '@/lib/limits'
export async function setStatus(form: FormData) {
  const { db, user } = await requireUser(),
    id = z.uuid().parse(form.get('id')),
    status = z.enum(statuses).parse(form.get('status'))
  const { error } = await db
    .from('leads')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error('Status update failed')
  revalidatePath('/app/leads/' + id)
  revalidatePath('/app')
}
export async function draftReply(
  idInput: string,
  toneInput: string,
  requestId: string,
) {
  const { db, user } = await requireUser(),
    id = z.uuid().parse(idInput),
    tone = z.enum(tones).parse(toneInput)
  const key = 'reply:' + id + ':' + z.uuid().parse(requestId),
    service = admin()
  if (!(await allowRequest('draft:' + user.id, 20, 600)))
    return 'Please wait before generating another draft.'
  const { data: lead, error } = await db
    .from('leads')
    .select('title,body,niche_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (error || !lead) return 'This lead is unavailable.'
  const [{ data: niche }, { data: profile }] = await Promise.all([
    db.from('niches').select('pitch_style').eq('id', lead.niche_id).single(),
    db.from('profiles').select('branding').eq('id', user.id).single(),
  ])
  const reserve = await service.rpc('reserve_usage', {
    p_user: user.id,
    p_key: key,
    p_type: 'response',
    p_cost: 1,
  })
  if (reserve.error) throw new Error('Could not reserve credit')
  if (!reserve.data)
    return 'No credit available or this draft has already been requested.'
  try {
    const draft = await generateReply(
      lead,
      tone,
      [profile?.branding, niche?.pitch_style].filter(Boolean).join('\n'),
    )
    const saved = await service.rpc('finalize_reply', {
      p_user: user.id,
      p_key: key,
      p_lead: id,
      p_id: requestId,
      p_tone: tone,
      p_solution: draft.solution_md,
      p_pitch: draft.pitch_md,
    })
    if (saved.error || !saved.data) throw new Error('Save failed')
  } catch {
    const { data } = await service
      .from('responses')
      .select('id')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data) {
      const refund = await service.rpc('refund_usage', {
        p_user: user.id,
        p_key: key,
      })
      if (refund.error) throw new Error('Credit recovery pending')
      return 'Draft unavailable. Your credit was returned.'
    }
  }
  revalidatePath('/app/leads/' + id)
  return null
}
export async function editReply(
  idInput: string,
  leadInput: string,
  solution: string,
  pitch: string,
) {
  const { db, user } = await requireUser(),
    id = z.uuid().parse(idInput),
    lead = z.uuid().parse(leadInput)
  const content = z.string().trim().min(1).max(16000)
  const { error } = await db
    .from('responses')
    .update({
      solution_md: content.parse(solution),
      pitch_md: content.parse(pitch),
    })
    .eq('id', id)
    .eq('lead_id', lead)
    .eq('user_id', user.id)
    .select('id')
    .single()
  if (error) throw new Error('Update failed')
  revalidatePath('/app/leads/' + lead)
}
