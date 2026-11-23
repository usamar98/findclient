import { z } from 'zod'
import { shareCard } from '@/lib/share-card'
export async function GET(request: Request) {
  const title = z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[\p{L}\p{N}\p{P}\p{Zs}+&|]+$/u)
    .safeParse(new URL(request.url).searchParams.get('title'))
  if (!title.success) return new Response('Invalid card title', { status: 400 })
  return shareCard(title.data)
}
