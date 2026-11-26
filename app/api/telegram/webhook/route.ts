import { createHash } from 'node:crypto'
import { getDailyJobs } from '@/lib/daily-jobs'
import { admin } from '@/lib/db/admin'
import { setTelegramJobWatch } from '@/lib/job-alerts'
import { allowRequest } from '@/lib/limits'
import { siteOrigin } from '@/lib/origin'
import { matchesSecret } from '@/lib/secrets'
import { sendTelegramText, TelegramDeliveryError } from '@/lib/send-telegram'
import { readTelegramUpdate, telegramReply } from '@/lib/telegram-bot'

export const maxDuration = 60

export async function POST(req: Request) {
  if (!matchesSecret(req.headers.get('x-telegram-bot-api-secret-token'), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response('Forbidden', { status: 403 })
  }
  const update = readTelegramUpdate(await req.json().catch(() => null), process.env.TELEGRAM_BOT_USERNAME)
  if (!update) return Response.json({ ok: true })
  if (!(await allowRequest('telegram-webhook', 300, 60))) return new Response('Retry later', { status: 429 })

  const { chatId, command, updateId } = update
  const db = admin()
  const bot = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '').toLowerCase()
  const updateKey = 'telegram:update:' + (bot || 'primary') + ':' + updateId
  const leaseKey = updateKey + ':processing'
  async function reserve(key: string, limit: number, seconds: number) {
    const { data, error } = await db.rpc('allow_request', { p_key: key, p_limit: limit, p_window: seconds })
    if (error) throw error
    return data === true
  }

  // Telegram retries deliveries. A short lease prevents duplicate simultaneous
  // commands; a completed receipt covers Telegram's 24-hour update retention.
  // Both records expire using the existing rate-limit table maintenance.
  const leased = await reserve(leaseKey, 1, 90)
  const receipt = await db.from('rate_limits').select('key').eq('key', updateKey).maybeSingle()
  if (receipt.error) throw receipt.error
  if (receipt.data) return Response.json({ ok: true })
  if (!leased) return new Response('Command in progress', { status: 503 })

  try {
    const reply = await telegramReply(command, {
      site: siteOrigin(),
      async link(token) {
        const { data, error } = await db.rpc('link_telegram', {
          p_chat: chatId,
          p_code: createHash('sha256').update(token).digest('hex'),
        })
        if (error?.code === '23505') return 'conflict'
        if (error) throw error
        return data ? 'linked' : 'expired'
      },
      async account() {
        const { data, error } = await db.from('profiles').select('id').eq('telegram_chat_id', chatId).maybeSingle()
        if (error) throw error
        return data?.id ?? null
      },
      async search(query) {
        if (!(await reserve('telegram:jobs:' + chatId, 10, 600))) return null
        return getDailyJobs(query)
      },
      setWatch: (userId, query) => setTelegramJobWatch(userId, chatId, query),
    })
    // A slow provider can outlast Telegram's webhook request. Deliver the
    // requested answer directly to its verified chat before acknowledging it.
    try {
      await sendTelegramText(chatId, reply.text, reply.buttons)
    } catch (error) {
      // The recipient may have blocked the bot while a search was running.
      if (!(error instanceof TelegramDeliveryError && error.status === 403)) throw error
    }
    const { error } = await db.from('rate_limits').insert({
      key: updateKey, hits: 1, window_end: new Date(Date.now() + 86400_000).toISOString(),
    })
    if (error) throw error

    return Response.json({ ok: true })
  } catch {
    await db.from('rate_limits').delete().eq('key', leaseKey)
    return new Response('Try again later', { status: 503 })
  }
}
