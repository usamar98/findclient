import type { statuses } from '@/lib/niche'
import type { LeadCrm } from '@/lib/workspace-types'
import { getWorkspacePeople } from '@/lib/workspace-access'
import { PipelineForm } from './agency-forms'

export async function LeadPipeline({ lead }: {
  lead: LeadCrm & { id: string; user_id: string; status: (typeof statuses)[number] }
}) {
  const people = await getWorkspacePeople(lead.user_id)
  return <section className="panel">
    <h2>Client pipeline</h2>
    <PipelineForm lead={{
      id: lead.id, status: lead.status, assignee_id: lead.assignee_id, deal_value_cents: lead.deal_value_cents,
      follow_up_on: lead.follow_up_on, crm_version: lead.crm_version,
    }} people={people} />
  </section>
}
