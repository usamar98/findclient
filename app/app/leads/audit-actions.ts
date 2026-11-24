'use server'
import { revalidatePath } from 'next/cache'
import { requireLeadAccess } from '@/lib/workspace-access'
import { admin } from '@/lib/db/admin'
import { allowRequest } from '@/lib/limits'
import { publicSite } from '@/lib/site-audit/target'
import { runSiteAudits } from '@/lib/site-audit/jobs'

export async function checkLeadSite(id: string, input: string) {
  const { user, lead } = await requireLeadAccess(id)
  const url = publicSite(input.trim())
  if (!url) return 'Enter a public website or store address.'
  if (!(await allowRequest('site-audit:' + user.id, 12, 3600)))
    return 'Please try again in an hour.'
  const { error } = await admin().from('lead_site_audits').upsert({
    lead_id: lead.id,
    target_url: url.href,
    status: 'queued',
    due_at: new Date().toISOString(),
    lease: null,
    attempts: 0,
    report: null,
    failure: null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error('Website check unavailable.')
  await runSiteAudits(lead.id)
  revalidatePath('/app/leads/' + lead.id)
  return 'Website check updated.'
}
