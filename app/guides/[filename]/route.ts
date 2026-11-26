import { platformGuideMarkdown } from '@/lib/platform-guide-markdown'
import { getPost, posts } from '@/lib/posts'
import { absolute } from '@/lib/seo'

export function generateStaticParams() {
  return [{ filename: 'platforms.md' }, ...posts().map((p) => ({ filename: p.slug + '.md' }))]
}

function markdownResponse(body: string, canonicalPath: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: '<' + absolute(canonicalPath) + '>; rel="canonical"',
      'X-Robots-Tag': 'noindex, follow',
    },
  })
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  if (filename === 'platforms.md') {
    return markdownResponse(platformGuideMarkdown() + '\n', '/platforms')
  }
  const post = filename.endsWith('.md')
    ? getPost(filename.slice(0, -3))
    : undefined
  if (!post) return new Response('Guide not found', { status: 404 })
  return markdownResponse(
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
    '/blog/' + post.slug,
  )
}
