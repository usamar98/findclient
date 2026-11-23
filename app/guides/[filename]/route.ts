import { getPost, posts } from '@/lib/posts'
export function generateStaticParams() {
  return posts().map((p) => ({ filename: p.slug + '.md' }))
}
export async function GET(
  _: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  const post = filename.endsWith('.md')
    ? getPost(filename.slice(0, -3))
    : undefined
  if (!post) return new Response('Guide not found', { status: 404 })
  return new Response(
    '# ' +
      post.title +
      '\n\nBy ' +
      post.author +
      ' · Last updated ' +
      post.updated +
      '\n\n**Quick answer** ' +
      post.quickAnswer +
      '\n\n' +
      post.body,
    {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Robots-Tag': 'noindex, follow',
      },
    },
  )
}
