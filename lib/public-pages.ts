import 'server-only'
import { niches } from './niche-content'
import { posts } from './posts'
import { platformGuideUpdated } from './platform-guide'
import { absolute, siteConfig } from './seo'
export const contentUpdated = '2026-11-24'
const updatedWithPlatformGuide = new Set(['/', '/platforms', '/about', '/faq', '/how-it-works', '/pricing', '/changelog'])
export const staticPageUpdated = (path: string) => updatedWithPlatformGuide.has(path) ? platformGuideUpdated : contentUpdated
export const staticPages = [
  ['/', 'Lead To Client'],
  ['/pricing', 'Pricing and credits'],
  ['/how-it-works', 'How Lead To Client works'],
  ['/platforms', 'Freelance lead sources and paid job platforms'],
  ['/faq', 'Frequently asked questions'],
  ['/about', 'About Lead To Client'],
  ['/blog', 'Freelance guides'],
  ['/find-clients', 'Find freelance clients by service'],
  ['/changelog', 'Changelog'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/contact', 'Contact'],
  ['/vs/gummysearch', 'Lead To Client vs GummySearch'],
  ['/vs/f5bot', 'Lead To Client vs F5Bot'],
  ['/vs/syften', 'Lead To Client vs Syften'],
  ['/vs/octolens', 'Lead To Client vs Octolens'],
  ['/alternatives/gummysearch', 'GummySearch alternatives in 2026'],
  ['/tools/reddit-lead-finder', 'Reddit lead finder'],
  ['/tools/proposal-generator', 'Freelance proposal generator'],
  ['/tools/client-pitch-writer', 'Client pitch writer'],
] as const
export function publicPages() {
  return [
    ...staticPages.map(([path, title]) => ({
      path,
      title,
      updated: staticPageUpdated(path),
    })),
    ...niches.map((n) => ({
      path: '/find-clients/' + n.slug,
      title: n.title,
      updated: contentUpdated,
    })),
    ...posts().map((p) => ({
      path: '/blog/' + p.slug,
      title: p.title,
      updated: p.updated,
    })),
  ]
}
export const sitemapLimit = 5000
export function sitemapEntries() {
  return siteConfig.indexable
    ? publicPages().map((page) => ({
        url: absolute(page.path),
        lastModified: page.updated,
      }))
    : []
}
export function xmlEscape(value: string) {
  return value.replace(
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
}
