'use server'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { admin } from '@/lib/db/admin'
import { requireUser } from '@/lib/db/server'
import { runEngine } from '@/lib/engine'
import { allowRequest } from '@/lib/limits'

const integer = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483647))

export async function startScan(_previous: string, form: FormData) {
  const { user } = await requireUser()
  const parsed = z.object({ niche: z.uuid(), request: z.uuid(), cap: integer.pipe(z.number().min(1)) })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) return 'Choose a saved search and a positive whole-number credit limit.'
  if (!(await allowRequest('manual-scan:' + user.id, 10, 600)))
    return 'You have requested several scans recently. Try again in a few minutes.'
  const { niche, request, cap } = parsed.data
  const { data, error } = await admin().rpc('start_manual_scan', {
    p_user: user.id, p_niche: niche, p_request: request, p_limit: cap,
  })
  if (error || !data) return 'Could not start this scan. Refresh your saved searches and try again.'
  after(async () => {
    try { await runEngine(false, data) }
    catch { console.error('Manual scan worker deferred', { run: data }) }
  })
  revalidatePath('/app/scans')
  revalidatePath('/app')
  revalidatePath('/app/inbox')
  return data === request ? 'Scan requested. Progress appears in the receipts below.' : 'A scan is already in progress for this search.'
}

export async function saveBudget(_previous: string, form: FormData) {
  const { user } = await requireUser()
  const raw = form.get('niche')
  const niche = raw === null ? null : z.uuid().safeParse(raw)
  if (niche && !niche.success) return 'Invalid saved search.'
  const rawLimit = form.get('amount')
  const amount = niche && rawLimit === '' ? null : integer.safeParse(rawLimit)
  if (amount && !amount.success) return 'Enter a whole number of credits.'
  const { error } = await admin().rpc('save_scan_budget', {
    p_user: user.id, p_niche: niche?.data ?? null, p_limit: amount?.data ?? null,
  })
  if (error) return 'The credit setting could not be saved.'
  revalidatePath('/app/scans')
  revalidatePath('/app')
  return niche ? 'Search budget saved.' : 'Reply reserve saved.'
}
