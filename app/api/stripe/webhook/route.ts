import { allowRequest } from '@/lib/limits'
import { verifyEvent } from '@/lib/payments'
import { handleStripeEvent } from '@/lib/checkout'
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook unavailable', { status: 503 })
  let event
  try {
    event = verifyEvent(
      await req.text(),
      req.headers.get('stripe-signature') ?? '',
      secret,
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }
  if (!(await allowRequest('stripe-webhook', 1000, 60)))
    return new Response('Retry delivery later', { status: 429 })
  await handleStripeEvent(event)
  return Response.json({ received: true })
}
