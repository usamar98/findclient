'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'

export async function saveVoice(form: FormData) {
  const { db, user } = await requireUser()
  const voice_examples = z.string().trim().max(3000).parse(form.get('examples'))
  const { error } = await db
    .from('profiles')
    .update({
      voice_examples,
      learn_from_edits: form.has('learn'),
    })
    .eq('id', user.id)
  if (error) throw new Error('Unable to save writing preferences.')
  revalidatePath('/app/settings')
}
