import { sitemapEntries, sitemapLimit, xmlEscape } from '@/lib/public-pages'
import { absolute } from '@/lib/seo'
export const dynamic = 'force-static'
export function GET() {
  const entries = sitemapEntries()
  const body =
    entries.length <= sitemapLimit
      ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        entries
          .map(
            (e) =>
              '<url><loc>' +
              xmlEscape(e.url) +
              '</loc><lastmod>' +
              e.lastModified +
              '</lastmod></url>',
          )
          .join('') +
        '</urlset>'
      : '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        Array.from(
          { length: Math.ceil(entries.length / sitemapLimit) },
          (_, i) =>
            '<sitemap><loc>' +
            xmlEscape(absolute('/sitemap/' + i + '.xml')) +
            '</loc></sitemap>',
        ).join('') +
        '</sitemapindex>'
  return new Response('<?xml version="1.0" encoding="UTF-8"?>' + body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
