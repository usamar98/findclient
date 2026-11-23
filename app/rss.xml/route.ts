import { posts } from '@/lib/posts'
import { siteOrigin } from '@/lib/origin'
const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  )
export async function GET() {
  const base = siteOrigin(),
    link = (path: string) => escapeXml(base + path)
  const data = posts()
    .map((p) => {
      const url = link('/blog/' + p.slug)
      return (
        '<item><title>' +
        escapeXml(p.title) +
        '</title><link>' +
        url +
        '</link><guid>' +
        url +
        '</guid><description>' +
        escapeXml(p.description) +
        '</description><category>' +
        escapeXml(p.category) +
        '</category><pubDate>' +
        new Date(p.published + 'T12:00:00Z').toUTCString() +
        '</pubDate></item>'
      )
    })
    .join('')
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Clientfind guides</title><link>' +
      link('/blog') +
      '</link><description>Field guides to finding freelance work in public conversations.</description><atom:link href="' +
      link('/rss.xml') +
      '" rel="self" type="application/rss+xml"/>' +
      data +
      '</channel></rss>',
    {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    },
  )
}
