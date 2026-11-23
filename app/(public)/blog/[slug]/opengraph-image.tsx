import { notFound } from 'next/navigation'
import { getPost } from '@/lib/posts'
import { shareCard } from '@/lib/share-card'
export const alt = 'Clientfind freelance guide'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const post = getPost((await params).slug)
  if (!post) notFound()
  return shareCard(post.title)
}
