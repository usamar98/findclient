import 'server-only'
import { admin } from '@/lib/db/admin'
import { generateReply } from '@/lib/ai'
import type { Database } from '@/lib/db/schema'
import { runSiteAudits } from '@/lib/site-audit/jobs'
import { replyContext } from '@/lib/reply-context'
import type { tones } from '@/lib/niche'

type Lead = Pick<Database['public']['Tables']['leads']['Row'], 'id' | 'niche_id' | 'title' | 'body'>
type Options = {
  db: ReturnType<typeof admin>
  lead: Lead
  authorId: string
  ownerId: string
  requestId: string
  tone: (typeof tones)[number]
  automated?: boolean
}

// Manual and rule-triggered replies share voice context, cost, settlement and refunds.
export async function produceReply({ db, lead, authorId, ownerId, requestId, tone, automated = false }: Options) {
  const id = lead.id
  const key = 'reply:' + id + ':' + requestId
  const service = admin()
  const [{ data: niche }, { data: profile }, { data: audit }] =
    await Promise.all([
      lead.niche_id
        ? db.from('niches').select('pitch_style').eq('id', lead.niche_id).single()
        : { data: null },
      db
        .from('profiles')
        .select('branding,voice_examples,learn_from_edits')
        .eq('id', authorId)
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
        .eq('voice_author_id', authorId)
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
  if (automated) {
    const reserve = await service.rpc('reserve_rule_draft', { p_notice: requestId })
    if (reserve.error) throw new Error('Could not reserve rule draft credit')
    if (['cap_reached','settled','obsolete'].includes(reserve.data)) return null
    if (reserve.data !== 'reserved') return 'Automatic draft waiting for an available credit.'
  } else {
    const reserve = await service.rpc('reserve_usage', { p_user: ownerId, p_key: key, p_type: 'response', p_cost: 1 })
    if (reserve.error) throw new Error('Could not reserve credit')
    if (!reserve.data) return 'No credit available or this draft has already been requested.'
  }
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
  return null
}
