import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { admin } from './db/admin'
import { loadDailyJobFeed } from './daily-jobs'
import { dailyJobSources, researchSourceLabels } from './research-catalog'
import { jobTimestamps } from './job-timestamps'
import { missingDatabaseResource } from './db/missing-resource'
import { sendTelegramText } from './send-telegram'

export async function setTelegramJobWatch(userId: string, chatId: string, query: string | null) {
  const { error } = await admin().rpc('set_telegram_job_watch', { p_user: userId, p_chat: chatId, p_query: query })
  if (error) throw error
}

export async function queueTelegramJobAlerts() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { status: 'bot_unconfigured' }
  const db = admin()
  const { data: watches, error } = await db.rpc('claim_telegram_job_watches', { p_limit: 100 })
  if (missingDatabaseResource(error, 'function', 'claim_telegram_job_watches')) return { status: 'migration_required' }
  if (error) throw error
  if (!watches.length) return { checked: 0, queued: 0 }

  const filter = await loadDailyJobFeed()
  let queued = 0
  for (const watch of watches) {
    // A provider may publish a listing to its feed late. Recheck the whole rolling
    // window and let the database enforce uniqueness across workers and retries.
    const start = Date.parse(watch.started_at)
    const notices = filter(watch.query).posts.filter(post => Date.parse(post.posted_at) >= start).map(post => ({
      user_id: watch.user_id,
      kind: 'telegram_job',
      event_key: 'telegram-job:' + watch.id + ':' + createHash('sha256').update(post.url).digest('hex'),
      payload: { watch_id: watch.id, title: post.title, url: post.url, source: post.source, posted_at: post.posted_at, first_found_at: post.first_found_at,
        engagement: post.engagement, compensation: post.compensation },
    }))
    if (!notices.length) continue
    const written = await db.from('notifications').upsert(notices, { onConflict: 'event_key', ignoreDuplicates: true, count: 'exact' })
    if (written.error) throw written.error
    queued += written.count ?? 0
  }
  return { checked: watches.length, queued }
}

const alertJob = z.object({
  watch_id: z.uuid(), title: z.string(), source: z.enum(dailyJobSources),
  url: z.url({ protocol: /^https$/ }), posted_at: z.iso.datetime({ offset: true }),
  first_found_at: z.iso.datetime({ offset: true }).optional(),
  engagement: z.enum(['paid_freelance', 'contract_pay_unlisted']).optional(), compensation: z.string().optional(),
})

export async function deliverTelegramJob(userId: string, chatId: string | null, payload: unknown) {
  if (!chatId) return
  const job = alertJob.parse(payload)
  const age = Date.now() - Date.parse(job.posted_at)
  if (age < 0 || age > 86_400_000) return
  const db = admin()
  const { data, error } = await db.from('telegram_job_watches').select('id')
    .eq('user_id', userId).eq('id', job.watch_id).eq('chat_id', chatId).maybeSingle()
  if (error) throw error
  if (!data) return
  if (job.source === 'hn' || job.source === 'bluesky') {
    const active = await db.from('shared_hiring_jobs').select('url')
      .eq('source', job.source).eq('url', job.url).not('listing', 'is', null).limit(1).maybeSingle()
    if (active.error) throw active.error
    if (!active.data) return
  }
  const title = job.title.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').trim().slice(0, 250)
  const pay = job.engagement === 'contract_pay_unlisted' ? 'Contract · Pay not listed' : job.compensation
  await sendTelegramText(chatId, [title, researchSourceLabels[job.source], jobTimestamps(job.posted_at, job.first_found_at), pay, job.url].filter(Boolean).join('\n'))
}
