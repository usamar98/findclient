import { createHash } from 'node:crypto'
import { z } from 'zod'
import { allowRequest } from '@/lib/limits'
import { admin } from '@/lib/db/admin'
import { matchesSecret } from '@/lib/secrets'
export async function POST(req: Request) {
  if (
    !matchesSecret(
      req.headers.get('x-telegram-bot-api-secret-token'),
      process.env.TELEGRAM_WEBHOOK_SECRET,
    )
  )
    return new Response('Forbidden', { status: 403 })
  if (!(await allowRequest('telegram-webhook', 300, 60)))
    return new Response('Retry later', { status: 429 })
  const update = z
    .object({
      message: z
        .object({
          text: z.string().max(4096).optional(),
          chat: z.object({ id: z.number().int(), type: z.string() }),
        })
        .optional(),
    })
    .safeParse(await req.json().catch(() => null))
  if (!update.success) return new Response('Invalid update', { status: 400 })
  const msg = update.data.message,
    token = msg?.text?.match(/^\/start ([a-f0-9]{48})$/)?.[1]
  if (msg?.chat.type === 'private' && token) {
    const { error } = await admin().rpc('link_telegram', {
      p_chat: String(msg.chat.id),
      p_code: createHash('sha256').update(token).digest('hex'),
    })
    if (error) throw error
  }
  return Response.json({ ok: true })
}
