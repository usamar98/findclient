import { NextResponse } from 'next/server'
import { authConfigured, database } from '@/lib/db/server'
import { allowRequest } from '@/lib/limits'
import { stripe } from '@/lib/payments'
import { isBillingOrigin, siteOrigin } from '@/lib/origin'
export async function POST(req: Request) {
  if (!isBillingOrigin(req))
    return new Response('Unexpected origin', { status: 403 })
  if (!authConfigured())
    return NextResponse.redirect(new URL('/auth/login', siteOrigin()), 303)
  const db = await database(),
    {
      data: { user },
    } = await db.auth.getUser()
  if (!user)
    return NextResponse.redirect(new URL('/auth/login', siteOrigin()), 303)
  if (!(await allowRequest('portal:' + user.id, 10, 300)))
    return new Response('Please wait', { status: 429 })
  const { data } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()
  if (!data?.stripe_customer_id)
    return new Response('No billing account yet', { status: 404 })
  const s = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: siteOrigin() + '/app/settings',
  })
  return NextResponse.redirect(s.url, 303)
}
