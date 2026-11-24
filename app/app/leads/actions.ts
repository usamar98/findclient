'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireLeadAccess } from '@/lib/workspace-access'
import { admin } from '@/lib/db/admin'
import { generateReply } from '@/lib/ai'
import { tones } from '@/lib/niche'
import { allowRequest } from '@/lib/limits'
import { runSiteAudits } from '@/lib/site-audit/jobs'
import { replyContext } from '@/lib/reply-context'
export async function draftReply(
  idInput: string,
  toneInput: string,
  requestId: string,
) {
  const { db, user, lead, ownerId } = await requireLeadAccess(idInput),
    id = lead.id,
    tone = z.enum(tones).parse(toneInput)
  const key = 'reply:' + id + ':' + z.uuid().parse(requestId),
    service = admin()
  if (!(await allowRequest('draft:' + user.id, 20, 600)))
    return 'Please wait before generating another draft.'
  const [{ data: niche }, { data: profile }, { data: audit }] =
    await Promise.all([
      db.from('niches').select('pitch_style').eq('id', lead.niche_id).single(),
      db
        .from('profiles')
        .select('branding,voice_examples,learn_from_edits')
        .eq('id', user.id)
        .single(),
      db
        .from('lead_site_audits')
        .select('report,status,failure')
        .eq('lead_id', id)
        .maybeSingle(),
    ])
  let report = audit?.report ?? null
  if (
    audit &&
    !audit.failure &&
    (audit.status === 'queued' || audit.status === 'checking')
  ) {
    await runSiteAudits(id)
    const checked = await db
      .from('lead_site_audits')
      .select('report,status,failure')
      .eq('lead_id', id)
      .single()
    if (!checked.error && checked.data.status === 'checking')
      return 'The website check is running. Please generate the draft again in a moment.'
    report = checked.data?.report ?? null
  }
  const samples = profile?.learn_from_edits
    ? await db
        .from('responses')
        .select('voice_sample')
        .eq('voice_author_id', user.id)
        .eq('user_id', ownerId)
        .neq('lead_id', id)
        .order('voice_edited_at', { ascending: false })
        .limit(3)
    : null
  const context = replyContext(
    profile?.voice_examples ?? '',
    samples?.data?.map((s) => s.voice_sample ?? '') ?? [],
    report,
  )
  const reserve = await service.rpc('reserve_usage', {
    p_user: ownerId,
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
      context,
    )
    const saved = await service.rpc('finalize_reply', {
      p_user: ownerId,
      p_key: key,
      p_lead: id,
      p_id: requestId,
      p_tone: tone,
      p_solution: [
        draft.solution_md,
        ...(report?.findings.length
          ? [
              'Website observations (' + new URL(report.url).hostname + ')',
              ...report.findings.map((f) => '• ' + f.evidence),
            ]
          : []),
      ].join('\n\n'),
      p_pitch: draft.pitch_md,
    })
    if (saved.error || !saved.data) throw new Error('Save failed')
  } catch {
    const { data } = await service
      .from('responses')
      .select('id')
      .eq('id', requestId)
      .eq('user_id', ownerId)
      .eq('lead_id', id)
      .maybeSingle()
    if (!data) {
      const refund = await service.rpc('refund_usage', {
        p_user: ownerId,
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
