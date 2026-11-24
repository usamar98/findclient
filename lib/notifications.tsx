import 'server-only'
import { Resend } from 'resend'
import { z } from 'zod'
import { admin } from './db/admin'
import { siteOrigin } from './origin'
import { Message } from '@/components/email/message'
import { priorityLead, sendPriorityWebhook } from './priority-alerts'
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
  const priority = isPriority
    ? await priorityLead(n.user_id,z.object({id:z.uuid()}).parse(n.payload).id,p.priority_alert_min)
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
    const res = await fetch(
      'https://api.telegram.org/bot' +
        process.env.TELEGRAM_BOT_TOKEN +
        '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: p.telegram_chat_id,
          text: priority.title + '\n' + priority.summary + '\n' + priority.workspace_url,
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
  const db = admin(),
    { data, error } = await db.rpc('claim_notifications', { p_limit: 30 })
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
