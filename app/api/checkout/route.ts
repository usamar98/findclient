import { NextResponse } from 'next/server'
import { authConfigured, database } from '@/lib/db/server'
import { allowRequest } from '@/lib/limits'
import { products } from '@/lib/payments'
import { startCheckout } from '@/lib/checkout'
import { isBillingOrigin, siteOrigin } from '@/lib/origin'
export async function POST(req: Request) {
  if (!isBillingOrigin(req))
    return new Response('Unexpected origin', { status: 403 })

  const p = products.safeParse((await req.formData()).get('product'))
  if (!p.success) return new Response('Unknown product', { status: 400 })
  const db = authConfigured() ? await database() : null
  const user = db ? (await db.auth.getUser()).data.user : null
  if (!user)
    return NextResponse.redirect(
      new URL('/auth/login?purchase=' + p.data, siteOrigin()),
      303,
    )
  if (!(await allowRequest('checkout:' + user.id, 10, 300)))
    return new Response('Please wait before opening another checkout.', {
      status: 429,
    })
  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !user.email
  )
    return NextResponse.redirect(
      new URL('/app/billing-status?setup=pending', siteOrigin()),
      303,
    )
  const url = await startCheckout(user.id, user.email, p.data)
  return url
    ? NextResponse.redirect(url, 303)
    : NextResponse.redirect(new URL('/app/billing-status', siteOrigin()), 303)
}
