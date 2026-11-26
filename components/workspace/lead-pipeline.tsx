import type { statuses } from '@/lib/niche'
import type { LeadCrm } from '@/lib/workspace-types'
import { getWorkspacePeople } from '@/lib/workspace-access'
import { MarkAppliedForm, PipelineForm } from './agency-forms'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

export async function LeadPipeline({ lead }: {
  lead: LeadCrm & { id: string; user_id: string; status: (typeof statuses)[number]; applied_at?: string | null }
}) {
  const people = await getWorkspacePeople(lead.user_id)
  return <section className="panel">
    <h2>Client pipeline</h2>
    {lead.applied_at
      ? <p>Applied <time dateTime={lead.applied_at}>{date.format(new Date(lead.applied_at))}</time></p>
      : lead.applied_at === null && <MarkAppliedForm leadId={lead.id} />}
    <PipelineForm lead={{
      id: lead.id, status: lead.status, assignee_id: lead.assignee_id, deal_value_cents: lead.deal_value_cents,
      follow_up_on: lead.follow_up_on, crm_version: lead.crm_version,
    }} people={people} />
  </section>
}
