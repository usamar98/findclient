'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { admin } from '@/lib/db/admin'
import { requireUser } from '@/lib/db/server'
import { alertDestination } from '@/lib/alert-webhook'
import { requireLeadAccess } from '@/lib/workspace-access'

export async function saveAlertSettings(_previous: string, form: FormData) {
  const { user } = await requireUser()
  const min = z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .safeParse(form.get('minimum'))
  if (!min.success) return 'Choose a minimum intent score between 0 and 100.'
  const field = String(form.get('endpoint') ?? '').trim()
  const clear = form.get('disconnect') === 'on'
  const endpoint = field ? alertDestination(field) : null
  if (field && (!endpoint || clear))
    return 'Enter one supported HTTPS webhook or choose Disconnect.'
  const { error } = await admin().rpc('save_alert_settings', {
    p_user: user.id,
    p_fast: form.get('fast') === 'on',
    p_email: form.get('email') === 'on',
    p_min: min.data,
    p_webhook: clear ? '' : (endpoint?.url ?? null),
  })
  if (error) return 'Alert preferences could not be saved. Try again.'
  revalidatePath('/app/settings')
  return 'Alert preferences saved.'
}

export async function saveMatchFeedback(form: FormData) {
  const id = z.uuid().parse(form.get('lead'))
  const feedback = z
    .enum(['good_fit', 'wrong_service', 'diy', 'seller', 'clear'])
    .parse(form.get('feedback'))
  const { db, ownerId } = await requireLeadAccess(id)
  const { error } = await db
    .from('leads')
    .update({ match_feedback: feedback === 'clear' ? null : feedback })
    .eq('id', id)
    .eq('user_id', ownerId)
    .select('id')
    .single()
  if (error) throw new Error('Match feedback could not be saved.')
  revalidatePath('/app/leads/' + id)
}
