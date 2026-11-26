import 'server-only'
import { admin } from './db/admin'
import { siteOrigin } from './origin'
import { alertDestination } from './alert-webhook'
import { assessBuyer, buyerSchema, requestLabels } from './lead-intelligence'
import { verifyLeadSource } from './verify-lead-source'

export async function priorityLead(owner: string, id: string, minimum: number) {
  const db = admin()
  const { data: lead, error } = await db
    .from('leads')
    .select(
      'id,title,body,source,url,author,posted_at,created_at,status,intent_score,intent_reason,buyer_intelligence',
    )
    .eq('user_id', owner)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (
    !lead ||
    lead.intent_score === null || lead.intent_score < minimum ||
    [
      'won',
      'lost',
      'ignored',
      'replied',
      'call_booked',
      'proposal_sent',
    ].includes(lead.status) ||
    Date.now() - Date.parse(lead.posted_at) > 7 * 86400000
  )
    return null
  const stored = buyerSchema.safeParse(lead.buyer_intelligence)
  const intel = stored.success ? stored.data : assessBuyer(lead)
  if (intel.availability.state === 'closed') return null
  if (
    !stored.success ||
    Date.now() - Date.parse(intel.availability.checked_at) > 180000
  ) {
    const { availability } = await verifyLeadSource(lead)
    intel.availability = availability
    const save = await db
      .from('leads')
      .update({ buyer_intelligence: intel })
      .eq('id', id)
      .eq('user_id', owner)
    if (save.error) throw save.error
    if (availability.state === 'closed') return null
  }
  return {
    lead_id: id,
    title: lead.title,
    source: lead.source,
    original_url: lead.url,
    workspace_url: siteOrigin() + '/app/leads/' + id,
    intent_score: lead.intent_score,
    buyer_quality: intel.quality_score,
    request_type: intel.request_type,
    evidence: intel.evidence.request,
    posted_at: lead.posted_at,
    detected_at: lead.created_at,
    availability: intel.availability,
    summary:
      requestLabels[intel.request_type] +
      ' · ' +
      lead.intent_score +
      '/100 intent. ' +
      (intel.evidence.request
        ? '“' + intel.evidence.request + '”'
        : lead.intent_reason),
  }
}

export async function sendPriorityWebhook(
  endpoint: string,
  lead: NonNullable<Awaited<ReturnType<typeof priorityLead>>>,
  eventId: string,
) {
  const destination = alertDestination(endpoint)
  if (!destination) throw new Error('Unsupported alert destination')
  const payload = destination.slack
    ? {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: lead.title + '\n' + lead.summary,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Review lead' },
                url: lead.workspace_url,
              },
            ],
          },
        ],
      }
    : { type: 'lead.qualified', event_id: eventId, ...lead }
  const response = await fetch(destination.url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(7000),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': eventId },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Webhook delivery failed')
}
