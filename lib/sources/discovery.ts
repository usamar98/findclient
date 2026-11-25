import { z } from 'zod'
import { cleanPosts, remote, type Adapter } from './shared'
export { shopify } from './forum-feeds'

const forumThreadPaths: Record<string, RegExp> = {
  'wordpress.org': /^\/support\/topic\/[^/]+\/?$/,
  'community.webflow.com': /^\/[^/]+\/post\/[^/]+\/?$/,
  'discourse.webflow.com': /^\/t\/(?:[^/]+\/)?\d+\/?$/,
  'forum.bubble.io': /^\/t\/(?:[^/]+\/)?\d+\/?$/,
}
const scopes = {
  reddit: ['reddit.com'],
  x: ['x.com', 'twitter.com'],
  indiehackers: ['indiehackers.com'],
  forums: Object.keys(forumThreadPaths),
} as const
const exaHit = z.object({
  title: z.string().nullish(),
  url: z.string(),
  author: z.string().nullish(),
  publishedDate: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).nullish(),
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
      const r = await remote('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({
          query,
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
          // Some indexes normalize a calendar date to midnight. Keep those useful
          // in week-long scans without presenting an invented minute of publication.
          const dayOnly = p.publishedDate.length === 10 ||
            new Date(p.publishedDate).toISOString().endsWith('T00:00:00.000Z')
          if (dayOnly && Date.now() - since.getTime() <= 86400000) return []
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
            const community = /^\/r\/([a-z0-9_]+)\/comments\/[a-z0-9]+(?:\/[^/.]+)?\/?$/i.exec(u.pathname)?.[1].toLowerCase()
            if (!community || (communities.length && !communities.includes(community))) return []
          }
          if (source === 'x' && !/^\/(?:[a-z0-9_]+|i\/web)\/status\/\d+\/?$/i.test(u.pathname))
            return []
          if (source === 'indiehackers' && !/^\/post\/[^/]+\/?$/i.test(u.pathname))
            return []
          // A thread's index timestamp does not establish when a linked reply was made.
          if (source === 'forums' && (!forumThreadPaths[u.hostname]?.test(u.pathname) || u.hash)) return []
          return [
            {
              source,
              title: p.title,
              url: p.url,
              body: p.highlights?.join(' ') ?? '',
              posted_at: p.publishedDate,
              ...(dayOnly ? { posted_precision: 'day' as const } : {}),
              author: p.author ?? '',
            },
          ]
        }),
        since,
      )
    },
  }
}
