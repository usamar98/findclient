import { NextResponse } from 'next/server'
import { z } from 'zod'
import { products } from '@/lib/payments'
import { workspaceDestination } from '@/lib/auth-destination'
import { cookies } from 'next/headers'
import { allowRequest } from '@/lib/limits'
import { authConfigured, database } from '@/lib/db/server'
import { siteOrigin } from '@/lib/origin'
export async function GET(req: Request) {
  if (!authConfigured())
    return NextResponse.redirect(new URL('/auth/login', siteOrigin()))
  if (!(await allowRequest('auth-callback', 30, 300)))
    return new Response('Too many attempts. Please try again later.', {
      status: 429,
    })
  const params = new URL(req.url).searchParams,
    db = await database()
  const token = z.string().min(1).max(2048)
  const hash = token.safeParse(params.get('token_hash')),
    code = token.safeParse(params.get('code'))
  const result = hash.success
    ? await db.auth.verifyOtp({ token_hash: hash.data, type: 'email' })
    : code.success
      ? await db.auth.exchangeCodeForSession(code.data)
      : { error: true }
  const jar = await cookies(),
    purchase = products.safeParse(jar.get('clientfind_checkout')?.value)
  const next = workspaceDestination(params.get('next')) ?? workspaceDestination(jar.get('leadtoclient_return')?.value)
  if (!result.error) {
    jar.delete({ name: 'clientfind_checkout', path: '/auth' })
    jar.delete({ name: 'leadtoclient_return', path: '/auth' })
  }
  const destination = purchase.success
    ? '/app/checkout/' + purchase.data
    : next ?? '/app'
  const retry = new URLSearchParams({ message: 'Sign-in was not completed. Please try again.' })
  if (purchase.success) retry.set('purchase', purchase.data)
  else if (next) retry.set('next', next)
  return NextResponse.redirect(
    new URL(
      result.error
        ? '/auth/login?' + retry.toString()
        : destination,
      siteOrigin(),
    ),
  )
}
