import 'server-only'
import { admin } from '@/lib/db/admin'
import { inspectWebsite } from './fetch'
import { mobileAudit } from './mobile'
import { addMobileResults } from './analyze'
import { posterWebsite } from './target'
import type { LeadAudit } from '@/lib/db/schema'

export async function runSiteAudits(leadId?: string) {
  const db = admin()
  const { data, error } = await db.rpc('claim_lead_audits', {
    p_lead: leadId,
    p_limit: leadId ? 1 : 4,
  })
  if (error) throw new Error('Website audit queue unavailable.')
  await Promise.all(
    (data ?? []).map(async (job) => {
      const target =
        job.target_url ?? posterWebsite(job.title, job.body, job.source_url)
      const update: Partial<LeadAudit> = {
        status: 'no_site',
        target_url: target,
        report: null,
        failure: null,
        lease: null,
        updated_at: new Date().toISOString(),
      }
      if (target) {
        try {
          const report = await inspectWebsite(target)
          update.report = addMobileResults(
            report,
            await mobileAudit(report.url),
          )
          update.status = 'complete'
        } catch {
          update.status = job.attempts < 3 ? 'queued' : 'unavailable'
          update.due_at = new Date(
            Date.now() + job.attempts * 15 * 60000,
          ).toISOString()
          update.failure =
            'Could not read this public page. The site may be offline or may restrict automated checks.'
        }
      }
      const saved = await db
        .from('lead_site_audits')
        .update(update)
        .eq('lead_id', job.lead_id)
        .eq('lease', job.lease)
      if (saved.error) throw new Error('Could not save website audit.')
    }),
  )
  return { processed: data?.length ?? 0 }
}
