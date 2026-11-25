'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { sources } from '@/lib/niche'

const optionalId = z.union([z.literal(''), z.uuid()]).transform(value => value || null)
const sourceIds = Object.keys(sources) as (keyof typeof sources)[]
const ruleInput = z.object({
  id: optionalId,
  name: z.string().trim().min(1).max(80),
  niche_id: optionalId,
  source: z.union([z.literal(''), z.enum(sourceIds)]).transform(value => value || null),
  min_score: z.coerce.number().int().min(0).max(100),
  assignee_id: optionalId,
})

export async function saveRule(_previous: string, form: FormData) {
  const { user } = await requireUser()
  const parsed = ruleInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return 'Check the rule name, search, minimum score and assignment.'
  const { id, ...fields } = parsed.data
  const values = {
    ...fields,
    user_id: user.id,
    draft_reply: form.has('draft_reply'),
    telegram: form.has('telegram'),
    enabled: form.has('enabled'),
    require_budget: form.has('require_budget'),
  }
  if (!values.assignee_id && !values.draft_reply && !values.telegram)
    return 'Choose an assignment, a reply draft or a Telegram alert.'
  const table = admin().from('lead_rules')
  const result = await (id ? table.update(values).eq('id',id).eq('user_id',user.id) : table.insert(values)).select('id').single()
  if (result.error) {
    if (result.error.code === 'P0001') return result.error.message
    return 'The rule could not be saved.'
  }
  revalidatePath('/app/automations')
  return 'Rule saved.'
}

export async function removeRule(form: FormData) {
  const { user } = await requireUser()
  const id = z.uuid().parse(form.get('id'))
  const result = await admin().from('lead_rules').delete().eq('id',id).eq('user_id',user.id)
  if (result.error) throw new Error('The rule could not be removed.')
  revalidatePath('/app/automations')
}

export async function saveSequence(_previous: string, form: FormData) {
  const { user } = await requireUser()
  const days = z.coerce.number().int().min(1).max(30).safeParse(form.get('days'))
  if (!days.success) return 'Choose a delay from 1 to 30 days.'
  const result = await admin().from('proposal_workflow_settings').upsert({
    user_id: user.id, enabled: form.has('enabled'), delay_days: days.data,
  })
  if (result.error) return 'The follow-up settings could not be saved.'
  revalidatePath('/app/automations')
  return 'Follow-up settings saved.'
}
