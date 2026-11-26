'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { admin } from '@/lib/db/admin'
import { requireUser } from '@/lib/db/server'
import { allowRequest } from '@/lib/limits'
import { statuses } from '@/lib/niche'
import { requireLeadAccess } from '@/lib/workspace-access'

export async function inviteMember(_previous: string, form: FormData) {
  const { user } = await requireUser()
  const email = z.email().max(254).safeParse(String(form.get('email') ?? '').trim().toLowerCase())
  if (!email.success || email.data === user.email?.toLowerCase()) return 'Enter the email of a teammate.'
  if (!(await allowRequest('invite:' + user.id, 12, 3600))) return 'Invitation limit reached. Try again in an hour.'
  const { error } = await admin().rpc('invite_workspace_member', { p_owner: user.id, p_email: email.data })
  if (error) return error.message.includes('Already on') ? 'This person has already joined.' : 'Could not create the invitation.'
  revalidatePath('/app/settings')
  return 'Invitation created. Your teammate can accept it in Settings when signed in with that email.'
}

export async function acceptInvite(form: FormData) {
  const { user } = await requireUser()
  const id = z.uuid().parse(form.get('invite'))
  if (!user.email_confirmed_at) throw new Error('Verify your email before joining this workspace.')
  const { error } = await admin().rpc('accept_workspace_invite', { p_invite: id, p_actor: user.id })
  if (error) throw new Error('Could not accept the invitation.')
  revalidatePath('/app', 'layout')
}

export async function cancelInvite(form: FormData) {
  const { db } = await requireUser()
  const { error } = await db.from('workspace_invites').delete().eq('id', z.uuid().parse(form.get('invite')))
  if (error) throw new Error('Could not dismiss the invitation.')
  revalidatePath('/app', 'layout')
}

export async function removeMember(form: FormData) {
  const { db } = await requireUser()
  const { error } = await db.from('workspace_members').delete()
    .eq('owner_id', z.uuid().parse(form.get('owner')))
    .eq('member_id', z.uuid().parse(form.get('member')))
  if (error) throw new Error('Could not remove this membership.')
  revalidatePath('/app', 'layout')
}

export async function markLeadApplied(id: string) {
  const { user } = await requireLeadAccess(id)
  const { data, error } = await admin().rpc('mark_inbox_job_applied', { p_actor: user.id, p_lead: id })
  if (error || !data) return 'Could not mark this job as applied. Please try again.'
  revalidatePath('/app/leads/' + id)
  revalidatePath('/app/inbox')
  revalidatePath('/app/jobs')
  revalidatePath('/app/research')
  return 'Application recorded.'
}

export async function savePipeline(id: string, _previous: string, form: FormData) {
  const { db } = await requireLeadAccess(id)
  const result = z.object({
    status: z.enum(statuses),
    amount: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,2})?)?$/),
    assignee: z.union([z.uuid(), z.literal('')]),
    date: z.union([z.iso.date(), z.literal('')]),
    version: z.coerce.number().int().nonnegative(),
  }).safeParse(Object.fromEntries(form))
  if (!result.success) return 'Check the amount, assignee, and follow-up date.'
  const { status, amount, assignee, date, version } = result.data
  const [dollars, cents = ''] = amount.split('.')
  const { data, error } = await db.from('leads').update({
    status, assignee_id: assignee || null, follow_up_on: date || null,
    deal_value_cents: Number(dollars) * 100 + Number(cents.padEnd(2, '0')),
  }).eq('id', id).eq('crm_version', version).select('id').maybeSingle()
  if (error) return 'Could not save. Check that the assignee is still in this workspace.'
  revalidatePath('/app/leads/' + id)
  revalidatePath('/app')
  revalidatePath('/app/inbox')
  revalidatePath('/app/results')
  return data ? 'Pipeline updated.' : 'Someone updated this lead. Review the latest values and try again.'
}
