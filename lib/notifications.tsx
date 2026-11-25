import 'server-only'
import { Resend } from 'resend'
import { z } from 'zod'
import { admin } from './db/admin'
import { siteOrigin } from './origin'
import { Message } from '@/components/email/message'
import { priorityLead, sendPriorityWebhook } from './priority-alerts'
import { produceReply } from './produce-reply'
type Notice = {
  id: string
  user_id: string
  kind: string
  payload: unknown
  attempts: number
}
const digest = z.object({
  leads: z.array(
    z.object({ id: z.uuid(), title: z.string(), intent_score: z.number() }),
  ),
})
async function deliver(n: Notice) {
  const db = admin(),
    { data: p, error } = await db
      .from('profiles')
      .select('email,digest_enabled,telegram_chat_id,credits,priority_email,priority_alert_min')
      .eq('id', n.user_id)
      .single()
  if (error) throw error
  const base = siteOrigin()
  const isPriority = ['telegram','webhook','priority_email'].includes(n.kind)
  if (n.kind === 'priority_email' && !p.priority_email) return
  if (n.kind === 'telegram' && !p.telegram_chat_id) return
  if (n.kind === 'rule_draft') {
    const { id } = z.object({ id: z.uuid() }).parse(n.payload)
    const { data: lead, error: leadError } = await db.from('leads')
      .select('id,user_id,niche_id,title,body,status,buyer_intelligence').eq('id', id).eq('user_id', n.user_id).maybeSingle()
    if (leadError) throw leadError
    if (!lead || !['new','saved'].includes(lead.status) ||
        z.object({ availability: z.object({ state: z.literal('closed') }) }).safeParse(lead.buyer_intelligence).success)
      return
    const previous = await db.from('responses').select('id').eq('id', n.id).eq('lead_id', id).maybeSingle()
    if (previous.error) throw previous.error
    if (previous.data) return
    const message = await produceReply({ db, lead, authorId: n.user_id, ownerId: n.user_id, requestId: n.id, tone: 'friendly', automated: true })
    if (message) throw new Error(message)
    return
  }
  const ruleAlert = n.kind === 'telegram' &&
    z.object({ rule_alert: z.literal(true) }).safeParse(n.payload).success
  const priority = isPriority
    ? await priorityLead(n.user_id,z.object({id:z.uuid()}).parse(n.payload).id,ruleAlert ? 0 : p.priority_alert_min)
    : null
  if (isPriority && !priority) return
  if (n.kind === 'webhook' && priority) {
    const {data, error} = await db.from('alert_destinations').select('webhook_url').eq('user_id',n.user_id).maybeSingle()
    if (error) throw error
    if (data) await sendPriorityWebhook(data.webhook_url,priority,n.id)
    return
  }
  if (n.kind === 'telegram' && priority) {
    if (!process.env.TELEGRAM_BOT_TOKEN)
      throw new Error('Telegram is not configured')
    const draftRef = z.object({ draft_id: z.uuid() }).safeParse(n.payload)
    let draftStatus = ''
    if (ruleAlert && draftRef.success) {
      const [response, receipt] = await Promise.all([
        db.from('responses').select('id').eq('id', draftRef.data.draft_id).eq('lead_id', priority.lead_id).eq('user_id', n.user_id).maybeSingle(),
        db.from('leads').select('rule_draft_capped').eq('id',priority.lead_id).eq('user_id',n.user_id).single(),
      ])
      if (response.error || receipt.error) throw new Error('Rule draft status unavailable')
      // The draft and notification can initially be claimed by different workers.
      // Still deliver a timely lead alert if generation needs longer retries.
      if (receipt.data.rule_draft_capped) draftStatus = 'Automatic draft skipped. This scan reached its credit limit.'
      else {
        if (!response.data && n.attempts < 3) throw new Error('Waiting for the rule draft')
        draftStatus = response.data ? 'Reply draft ready for review.' : 'Reply draft queued.'
      }
    }
    const res = await fetch(
      'https://api.telegram.org/bot' +
        process.env.TELEGRAM_BOT_TOKEN +
        '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: p.telegram_chat_id,
          text: [priority.title, priority.summary, draftStatus, priority.workspace_url + (draftStatus ? '#reply' : ''), priority.original_url].filter(Boolean).join('\n'),
        }),
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) throw new Error('Telegram delivery failed')
    return
  }
  let title: string,
    body: string,
    items: { label: string; url: string }[] = []
  let recipient = p.email
  switch (n.kind) {
    case 'proposal_open':
    case 'proposal_followup_ready': {
      const { id } = z.object({ id: z.uuid() }).parse(n.payload)
      const [deal, sequence, prefs] = await Promise.all([
        db.from('leads').select('title,status').eq('id',id).eq('user_id', n.user_id).maybeSingle(),
        db.from('proposal_followups').select('cancelled_at,prepared_at').eq('lead_id',id).maybeSingle(),
        db.from('proposal_workflow_settings').select('enabled').eq('user_id', n.user_id).maybeSingle(),
      ])
      if (deal.error || sequence.error || prefs.error) throw new Error('Proposal activity unavailable')
      if (!deal.data || !sequence.data || sequence.data.cancelled_at || prefs.data?.enabled === false ||
          ['call_booked','won','lost','ignored'].includes(deal.data.status)) return
      if (n.kind === 'proposal_open') {
        title = 'Your shared proposal was opened'
        body = 'A visitor opened the proposal for “' + deal.data.title + '”.'
      } else {
        if (!sequence.data.prepared_at) return
        title = 'Your proposal follow-up is ready'
        body = 'Review the follow-up draft for “' + deal.data.title + '”.'
      }
      items = [{ label: 'Review proposal activity', url: base + '/app/proposals/' + id + '#proposal-activity' }]
      break
    }
    case 'priority_email':
      if (!priority) return
      title = 'Priority lead · ' + priority.title
      body = priority.summary
      items = [{label:'Review this lead',url:priority.workspace_url}]
      break
    case 'welcome':
      title = 'Welcome to Lead To Client'
      body =
        'Choose your niche and the sources you want to search. Lead scans start once your workspace has credits.'
      items = [{ label: 'View pricing', url: base + '/pricing' }]
      break
    case 'receipt': {
      const r = z
        .object({ amount: z.number(), product: z.string() })
        .parse(n.payload)
      title = 'Your Lead To Client purchase'
      body =
        'Payment received: ' +
        Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(r.amount / 100) +
        ' for ' +
        r.product +
        '. Your credits are available now. Open billing in settings for your invoice.'
      break
    }
    case 'low':
      if (p.credits > 3) return
      title = 'Your Lead To Client balance is low'
      body =
        'You have ' +
        p.credits +
        ' credits left. Each scored request or generated reply uses one credit.'
      break
    case 'team_invite': {
      const { invite } = z.object({ invite: z.uuid() }).parse(n.payload)
      const invitation = await db.from('workspace_invites').select('email,owner_name')
        .eq('id', invite).eq('owner_id', n.user_id).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (invitation.error) throw invitation.error
      if (!invitation.data) return
      recipient = invitation.data.email
      title = 'Invitation to a Lead To Client agency inbox'
      body = invitation.data.owner_name + ' invited you to share their lead inbox. Sign in with this email address, then accept the invitation in Settings within seven days.'
      items = [
        { label: 'Review invitation', url: base + '/app/settings#team' },
        { label: 'Create an account', url: base + '/auth/signup' },
      ]
      break
    }
    case 'follow_up': {
      const reminder = z.object({ id: z.uuid(), date: z.iso.date() }).parse(n.payload)
      const lead = await db.from('leads').select('title,follow_up_on,user_id,assignee_id')
        .eq('id', reminder.id).maybeSingle()
      if (lead.error) throw lead.error
      if (!lead.data || lead.data.follow_up_on !== reminder.date ||
          (lead.data.assignee_id ?? lead.data.user_id) !== n.user_id) return
      title = 'Follow up on your Lead To Client lead'
      body = 'Your follow-up for “' + lead.data.title + '” is due.'
      items = [{ label: 'Open lead', url: base + '/app/leads/' + reminder.id }]
      break
    }
    case 'digest':
      if (!p.digest_enabled) return
      title = 'Your daily Lead To Client leads'
      body =
        'These requests received the highest intent scores in your latest daily digest. You can change digest delivery in settings.'
      items = digest
        .parse(n.payload)
        .leads.map((l) => ({
          label: l.title + ' · ' + l.intent_score + '/100',
          url: base + '/app/leads/' + l.id,
        }))
      break
    default:
      throw new Error('Unknown notification')
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error('Email is not configured')
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
    {
      from: process.env.EMAIL_FROM,
      to: recipient,
      subject: title,
      react: (
        <Message title={title} body={body} items={items} url={base + '/app'} />
      ),
    },
    { idempotencyKey: 'clientfind/' + n.id },
  )
  if (result.error) throw new Error('Email delivery failed')
}
export async function deliverNotifications() {
  const db = admin()
  const prepared = await db.rpc('prepare_proposal_followups')
  // Existing notification deliveries continue while a new database migration is rolling out.
  if (prepared.error && !['PGRST202','42883'].includes(prepared.error.code)) throw prepared.error
  const { data, error } = await db.rpc('claim_notifications', { p_limit: 30 })
  if (error) throw error
  const counts = { sent: 0, retrying: 0 }
  const jobs = (data ?? []) as Notice[]
  for (let i = 0; i < jobs.length; i += 5)
    await Promise.all(
      jobs.slice(i, i + 5).map(async (job) => {
        try {
          await deliver(job)
          const r = await db
            .from('notifications')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', job.id)
          if (r.error) throw r.error
          counts.sent++
        } catch {
          const delay = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7))
          const r = await db
            .from('notifications')
            .update({
              available_at: new Date(Date.now() + delay * 1000).toISOString(),
            })
            .eq('id', job.id)
          if (r.error) throw r.error
          counts.retrying++
        }
      }),
    )
  return counts
}
