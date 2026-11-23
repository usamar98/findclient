import 'server-only'
import { Resend } from 'resend'
import { z } from 'zod'
import { admin } from './db/admin'
import { siteOrigin } from './origin'
import { Message } from '@/components/email/message'
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
      .select('email,digest_enabled,telegram_chat_id,credits')
      .eq('id', n.user_id)
      .single()
  if (error) throw error
  const base = siteOrigin()
  if (n.kind === 'telegram') {
    if (!p.telegram_chat_id) return
    const lead = z
      .object({ id: z.uuid(), title: z.string(), score: z.number() })
      .parse(n.payload)
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
          text:
            lead.title +
            '\nBuying intent: ' +
            lead.score +
            '/100\n' +
            base +
            '/app/leads/' +
            lead.id,
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
  switch (n.kind) {
    case 'welcome':
      title = 'Welcome to Clientfind'
      body =
        'Your workspace starts with 15 credits. Pick your niche and sources to start the hourly lead scan.'
      break
    case 'receipt': {
      const r = z
        .object({ amount: z.number(), product: z.string() })
        .parse(n.payload)
      title = 'Your Clientfind purchase'
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
      title = 'Your Clientfind balance is low'
      body =
        'You have ' +
        p.credits +
        ' credits left. Each scored request or generated reply uses one credit.'
      break
    case 'digest':
      if (!p.digest_enabled) return
      title = 'Your daily Clientfind leads'
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
      to: p.email,
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
