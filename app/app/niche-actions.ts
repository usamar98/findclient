'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { allowRequest } from '@/lib/limits'
import { nicheSchema, portfolio } from '@/lib/niche'
import { suggestKeywords } from '@/lib/ai'
export async function suggestions(rawSkill: string, rawUrl: string) {
  const { user } = await requireUser()
  const { skill, url } = z
    .object({ skill: z.string().trim().min(2).max(100), url: portfolio })
    .parse({ skill: rawSkill, url: rawUrl })
  if (!(await allowRequest('keywords:' + user.id, 5, 3600)))
    throw new Error('Suggestion limit reached.')
  let excerpt = ''
  if (url) {
    const result = await fetch('https://r.jina.ai/' + url, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    })
    if (!result.ok) throw new Error('Portfolio unavailable')
    const reader = result.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      try {
        while (excerpt.length < 6000) {
          const chunk = await reader.read()
          if (chunk.done) break
          excerpt += decoder
            .decode(chunk.value, { stream: true })
            .slice(0, 6000 - excerpt.length)
        }
      } finally {
        await reader.cancel()
      }
    }
  }
  return suggestKeywords(skill, excerpt)
}
export async function saveNiche(raw: unknown, rawId?: string) {
  const { user } = await requireUser(),
    data = nicheSchema.parse(raw),
    id = z.uuid().optional().parse(rawId)
  const result = await admin().rpc('save_niche', {
    p_user: user.id,
    p_id: id ?? null,
    p_data: data,
  })
  if (result.error)
    return {
      error: result.error.message.includes('limit')
        ? 'Your plan’s niche limit has been reached.'
        : 'The niche could not be saved.',
    }
  revalidatePath('/app/settings')
  revalidatePath('/app')
  revalidatePath('/app/inbox')
  revalidatePath('/app/scans')
  return { error: null }
}
export async function removeNiche(form: FormData) {
  const { user } = await requireUser(),
    id = z.uuid().parse(form.get('id'))
  const { error } = await admin()
    .from('niches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error('Could not delete niche')
  revalidatePath('/app/settings')
  revalidatePath('/app')
  revalidatePath('/app/inbox')
  revalidatePath('/app/scans')
}
