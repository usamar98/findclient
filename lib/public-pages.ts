import 'server-only'
import { niches } from './niche-content'
import { posts } from './posts'
import { absolute, siteConfig } from './seo'
export const contentUpdated = '2026-11-23'
export const staticPages = [
  ['/', 'Clientfind'],
  ['/pricing', 'Pricing and credits'],
  ['/how-it-works', 'How Clientfind works'],
  ['/faq', 'Frequently asked questions'],
  ['/about', 'About Clientfind'],
  ['/blog', 'Freelance guides'],
  ['/changelog', 'Changelog'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/contact', 'Contact'],
  ['/vs/gummysearch', 'Clientfind vs GummySearch'],
  ['/vs/f5bot', 'Clientfind vs F5Bot'],
  ['/vs/syften', 'Clientfind vs Syften'],
  ['/vs/octolens', 'Clientfind vs Octolens'],
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
      updated: contentUpdated,
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
