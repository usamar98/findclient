'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { products } from '@/lib/payments'
import { cookies } from 'next/headers'
import { authConfigured, database } from '@/lib/db/server'
import { siteOrigin } from '@/lib/origin'
import { allowRequest } from '@/lib/limits'
export async function signIn(form: FormData) {
  const mode = form.get('mode') === 'signup' ? 'signup' : 'login'
  const choice = products.safeParse(form.get('purchase'))
  const feedback = (message: string): never => {
    const params = new URLSearchParams({ message })
    if (choice.success) params.set('purchase', choice.data)
    redirect('/auth/' + mode + '?' + params)
  }
  if (!authConfigured()) return feedback('Accounts will open when Lead To Client connects its sign-in provider.')
  const provider = z.enum(['email', 'google']).safeParse(form.get('provider'))
  if (!provider.success) return feedback('Choose an available sign-in method.')
  if (!(await allowRequest('login', 10, 600)))
    return feedback('Please wait a few minutes before trying again.')
  const jar = await cookies()
  if (choice.success)
    jar.set('clientfind_checkout', choice.data, {
      httpOnly: true,
      sameSite: 'lax',
      secure: siteOrigin().startsWith('https:'),
      path: '/auth',
      maxAge: 1800,
    })
  else jar.delete({ name: 'clientfind_checkout', path: '/auth' })
  const db = await database(),
    callback = siteOrigin() + '/auth/callback'
  if (provider.data === 'google') {
    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback },
    })
    if (error || !data.url)
      return feedback('Google sign-in is unavailable. Try again shortly.')
    redirect(data.url)
  }
  const email = z.email().safeParse(form.get('email'))
  if (!email.success) return feedback('Enter a valid email address.')
  const { error } = await db.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: callback, shouldCreateUser: mode === 'signup' },
  })
  feedback(
    error
      ? 'The sign-in email could not be sent. Please try again.'
      : 'Check your inbox for your secure link.',
  )
}
export async function signOut() {
  const db = await database()
  await db.auth.signOut()
  redirect('/')
}
