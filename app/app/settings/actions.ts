'use server'
import { randomBytes, createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
export async function savePreferences(f: FormData) {
  const { db, user } = await requireUser(),
    preferences = z
      .object({
        name: z.string().trim().max(100),
        branding: z.string().trim().max(600),
        digest_enabled: z.boolean(),
      })
      .parse({
        name: f.get('name'),
        branding: f.get('branding'),
        digest_enabled: f.has('digest'),
      })
  const { error } = await db
    .from('profiles')
    .update(preferences)
    .eq('id', user.id)
  if (error) throw new Error('Could not save preferences')
  revalidatePath('/app/settings')
}
export async function connectTelegram() {
  const { user } = await requireUser(),
    bot = z
      .string()
      .regex(/^[A-Za-z0-9_]+$/)
      .parse(process.env.TELEGRAM_BOT_USERNAME),
    token = randomBytes(24).toString('hex')
  const { error } = await admin()
    .from('telegram_codes')
    .upsert(
      {
        user_id: user.id,
        code: createHash('sha256').update(token).digest('hex'),
        expires_at: new Date(Date.now() + 600000).toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error('Could not create Telegram link')
  redirect('https://t.me/' + bot + '?start=' + token)
}
export async function disconnectTelegram() {
  const { user } = await requireUser(),
    db = admin()
  const { error } = await db
    .from('telegram_codes')
    .delete()
    .eq('user_id', user.id)
  if (error) throw error
  const result = await db
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('id', user.id)
  if (result.error) throw result.error
  revalidatePath('/app/settings')
}
