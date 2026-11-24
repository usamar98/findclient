import type { MetadataRoute } from 'next'
import { absolute, siteConfig } from '@/lib/seo'
export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.indexable) return { rules: { userAgent: '*', disallow: '/' } }

  // All crawlers use the same public catalog, including Googlebot, Bingbot,
  // OAI-SearchBot, Claude-SearchBot and PerplexityBot. Match path boundaries
  // so /app stays private without blocking assets such as /apple-icon.png.
  const privatePaths = ['dashboard', 'api', 'auth', 'app', 'checkout', 'p']
    .flatMap((path) => ['/' + path + '$', '/' + path + '/', '/' + path + '?'])
  return {
    rules: { userAgent: '*', allow: '/', disallow: privatePaths },
    sitemap: absolute('/sitemap.xml'),
  }
}
