import type { MetadataRoute } from 'next'
import { absolute, siteConfig } from '@/lib/seo'
export default function robots(): MetadataRoute.Robots {
  const agents = [
    '*',
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'ClaudeBot',
    'Google-Extended',
    'Applebot-Extended',
    'Bingbot',
  ]
  const privatePaths = ['/dashboard', '/api', '/auth', '/app', '/checkout']
  return {
    rules: agents.map((userAgent) =>
      siteConfig.indexable
        ? { userAgent, allow: '/', disallow: privatePaths }
        : { userAgent, disallow: '/' },
    ),
    ...(siteConfig.indexable ? { sitemap: absolute('/sitemap.xml') } : {}),
  }
}
