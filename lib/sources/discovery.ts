import robotsParser from 'robots-parser'
import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'
import { cleanPosts, plain, remote, type Adapter } from './shared'
const rssItem = z.object({
  title: z.string(),
  link: z.string(),
  description: z.string().optional(),
  pubDate: z.string(),
  'dc:creator': z.string().optional(),
})
const feed = 'https://community.shopify.com/latest.rss'
const robotsUrl = 'https://community.shopify.com/robots.txt'
export const shopify: Adapter = {
  async search(query, since) {
    const headers = { 'User-Agent': 'LeadToClient/1.0 (community RSS reader)' }
    const robots = await remote(robotsUrl, {
      headers,
      next: { revalidate: 3600 },
    })
    const rules = robotsParser(robotsUrl, await robots.text())
    // Honor existing site owners' crawler preferences after the rename.
    const agents = ['LeadToClient', 'Clientfind']
    if (agents.some(agent => rules.isAllowed(feed, agent) !== true)) return []
    const cacheSeconds = Math.max(600, ...agents.map(agent => rules.getCrawlDelay(agent) ?? 0))
    const response = await remote(feed, {
      headers,
      next: { revalidate: cacheSeconds },
    })
    const xml = await response.text()
    if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml))
      throw new Error('Invalid RSS document.')
    const doc = new XMLParser({
      parseTagValue: false,
      processEntities: false,
      isArray: (_name, path) => path === 'rss.channel.item',
    }).parse(xml)
    const rows = z
      .object({
        rss: z.object({
          channel: z.object({ item: z.array(z.unknown()).default([]) }),
        }),
      })
      .parse(doc).rss.channel.item
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => w !== 'shopify')
    return cleanPosts(
      rows.flatMap((x) => {
        const parsed = rssItem.safeParse(x)
        if (!parsed.success) return []
        const p = parsed.data
        if (!p.link.startsWith('https://community.shopify.com/t/')) return []
        const body = p.description ?? ''
        const searchable = plain(p.title + ' ' + body).toLowerCase()
        if (!words.every((w) => searchable.includes(w))) return []
        return [
          {
            source: 'shopify',
            url: p.link,
            title: p.title,
            body,
            posted_at: p.pubDate,
            author: p['dc:creator'] ?? '',
          },
        ]
      }),
      since,
    )
  },
}
const scopes = {
  reddit: ['reddit.com'],
  x: ['x.com', 'twitter.com'],
  indiehackers: ['indiehackers.com'],
  forums: ['discourse.webflow.com', 'forum.bubble.io', 'wordpress.org'],
} as const
const exaHit = z.object({
  title: z.string().nullish(),
  url: z.string(),
  author: z.string().nullish(),
  publishedDate: z.string().nullish(),
  highlights: z.array(z.string()).nullish(),
})
export function indexed(source: keyof typeof scopes): Adapter {
  return {
    async search(query, since, watches) {
      const key = process.env.EXA_API_KEY
      if (!key) throw new Error('Indexed source search is not configured.')
      const domains: readonly string[] = scopes[source]
      const communities = source === 'reddit' ? watches?.subreddits ?? [] : []
      const paths = communities.length ? communities.map(s => 'reddit.com/r/' + s + '/') : domains
      const scope = domains.map((d) => 'site:' + d).join(' OR ')
      const r = await remote('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({
          query: (communities.length ? '' : '(' + scope + ') ') + query + ' looking for help',
          type: 'lite',
          includeDomains: paths,
          startPublishedDate: since.toISOString(),
          numResults: 8,
          contents: { highlights: { maxCharacters: 1200 } },
        }),
      })
      const raw = z
        .object({ results: z.array(z.unknown()) })
        .parse(await r.json())
      return cleanPosts(
        raw.results.flatMap((x) => {
          const parsed = exaHit.safeParse(x)
          if (!parsed.success) return []
          const p = parsed.data
          if (!p.title || !p.publishedDate) return []
          let u: URL
          try {
            u = new URL(p.url)
          } catch {
            return []
          }
          if (
            !domains.some(
              (d) => u.hostname === d || u.hostname.endsWith('.' + d),
            )
          )
            return []
          if (source === 'reddit') {
            const community = /^\/r\/([a-z0-9_]+)\/comments\/[a-z0-9]+(?:\/|$)/i.exec(u.pathname)?.[1].toLowerCase()
            if (!community || (communities.length && !communities.includes(community))) return []
          }
          if (source === 'x' && !/^\/[^/]+\/status\/\d+/i.test(u.pathname))
            return []
          if (source === 'indiehackers' && !/^\/post\//i.test(u.pathname))
            return []
          if (
            source === 'forums' &&
            !/^\/(t\/|support\/topic\/)/i.test(u.pathname)
          )
            return []
          return [
            {
              source,
              title: p.title,
              url: p.url,
              body: p.highlights?.join(' ') ?? '',
              posted_at: p.publishedDate,
              author: p.author ?? '',
            },
          ]
        }),
        since,
      )
    },
  }
}
