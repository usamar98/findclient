import type { MetadataRoute } from 'next'
import { sitemapEntries, sitemapLimit } from '@/lib/public-pages'
export function generateSitemaps() {
  return Array.from(
    { length: Math.max(1, Math.ceil(sitemapEntries().length / sitemapLimit)) },
    (_, id) => ({ id }),
  )
}
export default function sitemap({ id }: { id: number }): MetadataRoute.Sitemap {
  const start = Number(id) * sitemapLimit
  return sitemapEntries().slice(start, start + sitemapLimit)
}
