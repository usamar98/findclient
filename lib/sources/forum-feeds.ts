import robotsParser from 'robots-parser'
import { XMLParser } from 'fast-xml-parser'
import { Parser } from 'htmlparser2'
import { z } from 'zod'
import { cleanPosts, ProviderBackoff, remote, type Adapter, type NormalizedPost } from './shared'

type PublishedFeed = {
  url: string
  postPath: RegExp
  source: 'shopify' | 'forums'
  community: string
  entries?: 'discourse-posts' | 'wordpress-posts'
}
const discourseTopic = /^\/t\/(?:[^/]+\/)?\d+\/?$/
const feeds = [
  { community: 'Bubble', url: 'https://forum.bubble.io/latest.rss?order=created', postPath: discourseTopic, source: 'forums' },
  { community: 'WordPress', url: 'https://wordpress.org/support/forums/feed/', postPath: /^\/support\/topic\/[^/]+\/?$/, source: 'forums', entries: 'wordpress-posts' },
  { community: 'Webflow', url: 'https://community.webflow.com/rss/feed', postPath: /^\/[^/]+\/post\/[^/]+\/?$/, source: 'forums' },
] as const satisfies readonly PublishedFeed[]
export const forumFeedKeys = feeds.map(feed => 'forum:' + feed.community.toLowerCase())
const shopifyFeeds = [
  { community: 'Shopify merchants', url: 'https://community.shopify.com/posts.rss', postPath: discourseTopic, source: 'shopify', entries: 'discourse-posts' },
  { community: 'Shopify developers', url: 'https://community.shopify.dev/posts.rss', postPath: discourseTopic, source: 'shopify', entries: 'discourse-posts' },
] as const satisfies readonly PublishedFeed[]
export const shopifyFeedKeys = ['shopify', 'shopify:developers']
const item = z.object({
  title: z.string(),
  link: z.string().url(),
  description: z.string().optional(),
  'content:encoded': z.string().optional(),
  'dc:creator': z.string().optional(),
  pubDate: z.string().regex(/\d{2}:\d{2}:\d{2}\s+(?:[+-]\d{4}|UTC|GMT)$/i),
  'discourse:topicClosed': z.string().optional(),
  'discourse:topicArchived': z.string().optional(),
})
const channel = z.object({ rss: z.object({ channel: z.object({ item: z.array(z.unknown()).default([]) }) }) })
const xmlParser = new XMLParser({
  parseTagValue: false,
  processEntities: false,
  isArray: (_name, path) => path === 'rss.channel.item',
})

async function bodyText(response: Response, byteLimit: number) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty feed response.')
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return text + decoder.decode()
      size += chunk.value.byteLength
      if (size > byteLimit) {
        await reader.cancel()
        throw new Error('Feed response exceeds the size limit.')
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally { reader.releaseLock() }
}

const headers = { 'User-Agent': 'LeadToClient/1.0 (community RSS reader)' }
const agents = ['LeadToClient', 'Clientfind']
async function publisherRules(origin: string) {
  const robotsUrl = origin + '/robots.txt'
  const robots = await remote(robotsUrl, { headers, next: { revalidate: 3600 } })
  return robotsParser(robotsUrl, await bodyText(robots, 512000))
}

// A help request inside a quoted parent post doesn't belong to the person replying.
function authorText(html: string) {
  let skipped = 0
  const chunks: string[] = []
  const parser = new Parser({
    onopentag(name, attrs) {
      if (skipped || ['blockquote', 'aside', 'script', 'style', 'q', 'cite'].includes(name) ||
        /(?:^|\s)(?:quote|bbp-reply-signature|discourse-post-footer)(?:\s|$)/.test(attrs.class ?? '')) skipped++
      else if (['p', 'br', 'li', 'div'].includes(name)) chunks.push(' ')
    },
    onclosetag(name) {
      if (skipped) skipped--
      else if (['p', 'li', 'div'].includes(name)) chunks.push(' ')
    },
    ontext(value) { if (!skipped) chunks.push(value) },
  })
  parser.end(html)
  return chunks.join('').replace(/\s+/g, ' ').trim()
}

async function readFeed(feed: PublishedFeed, since: Date, rules: Awaited<ReturnType<typeof publisherRules>>, onSampled?: () => void) {
  const origin = new URL(feed.url).origin
  if (agents.some(agent => rules.isAllowed(feed.url, agent) !== true)) throw new FeedAccessRestricted()
  const cacheSeconds = Math.max(60, ...agents.map(agent => rules.getCrawlDelay(agent) ?? 0))
  const response = await remote(feed.url, { headers, next: { revalidate: cacheSeconds } })
  const xml = await bodyText(response, 2_000_000)
  if (/<!DOCTYPE/i.test(xml)) throw new Error('Invalid feed.')
  const rows = channel.parse(xmlParser.parse(xml)).rss.channel.item
  const posts: NormalizedPost[] = []
  let oldest = Infinity
  for (const row of rows) {
    const parsed = item.safeParse(row)
    if (!parsed.success) continue
    const p = parsed.data
    const published = Date.parse(p.pubDate)
    if (Number.isFinite(published)) oldest = Math.min(oldest, published)
    if (p['discourse:topicClosed'] === 'Yes' || p['discourse:topicArchived'] === 'Yes') continue
    const link = new URL(p.link)
    if (link.origin !== origin || !feed.postPath.test(link.pathname)) continue
    const html = p['content:encoded'] || p.description || ''
    const body = feed.entries || onSampled ? authorText(html) : html
    let title = p.title
    if (feed.entries) {
      const discourse = feed.entries === 'discourse-posts'
      const number = (discourse ? /^#post_([1-9]\d*)$/ : /^#post-([1-9]\d*)$/).exec(link.hash)?.[1]
      if (!number) continue
      if (!body) continue
      // The feed title of a Discourse reply is the parent topic's title.
      if ((discourse && number !== '1') || (!discourse && /^reply to:/i.test(title.trim()))) title = body.slice(0, 180)
      if (discourse) {
        link.hash = ''
        link.search = ''
        link.pathname = link.pathname.replace(/\/$/, '') + (number === '1' ? '' : '/' + number)
      }
    }
    posts.push({
      source: feed.source, title, url: link.href, body,
      author: p['dc:creator'] ?? '', posted_at: p.pubDate,
    })
  }
  if (rows.length >= 10 && Number.isFinite(oldest) && oldest > since.getTime()) onSampled?.()
  return cleanPosts(posts, since)
}

async function searchFeed(feed: PublishedFeed, query: string, since: Date) {
  const rules = await publisherRules(new URL(feed.url).origin)
  const posts = await readFeed(feed, since, rules)
  const words = query.toLowerCase().split(/\s+/).filter(word => word && word !== feed.community.toLowerCase())
  return posts.filter(post => {
    const text = (post.title + ' ' + post.body).toLowerCase()
    return words.every(word => text.includes(word))
  })
}

export class FeedAccessRestricted extends Error {
  constructor() { super('The publisher restricts access to this feed.') }
}

export const shopifyRecent: Adapter = {
  search: (query, since) => searchFeed({
    community: 'Shopify', url: 'https://community.shopify.com/latest.rss?order=created',
    postPath: discourseTopic, source: 'shopify',
  }, query, since),
}

export const shopify: Adapter = {
  async search(query, since) {
    try {
      return await shopifyRecent.search(query, since)
    } catch (error) {
      if (error instanceof FeedAccessRestricted) return []
      throw error
    }
  },
}

export async function searchForumFeeds(query: string, since: Date, cooldowns: ReadonlyMap<string, number> = new Map()) {
  return collectFeeds(feeds.map((feed, i) => ({
    key: forumFeedKeys[i], label: feed.community, read: () => searchFeed(feed, query, since),
  })), cooldowns)
}

type FeedTask = { key: string; label: string; read(): Promise<NormalizedPost[]> }

async function collectFeeds(tasks: FeedTask[], cooldowns: ReadonlyMap<string, number>) {
  const results = await Promise.allSettled(tasks.map(task =>
    (cooldowns.get(task.key) ?? 0) > Date.now() ? Promise.resolve(null) : task.read(),
  ))
  const checked: string[] = []
  const unavailable: string[] = []
  const backoffs: { source: string; retryAt: Date }[] = []
  const posts: NormalizedPost[] = []
  for (const [i, result] of results.entries()) {
    const community = tasks[i].label
    if (result.status === 'fulfilled' && result.value !== null) {
      checked.push(community)
      posts.push(...result.value)
    } else {
      unavailable.push(community)
      if (result.status === 'rejected' && result.reason instanceof ProviderBackoff) {
        backoffs.push({ source: tasks[i].key, retryAt: result.reason.retryAt })
      }
    }
  }
  const unique = new Map<string, NormalizedPost>()
  for (const post of posts) if (!unique.has(post.url)) unique.set(post.url, post)
  return { posts: [...unique.values()].sort((a, b) => b.posted_at.localeCompare(a.posted_at)), checked, unavailable, backoffs }
}

async function liveFeeds(communities: readonly PublishedFeed[], keys: string[], since: Date, cooldowns: ReadonlyMap<string, number>) {
  const rules = new Map<string, ReturnType<typeof publisherRules>>()
  const tasks: FeedTask[] = []
  let sampled = false
  const markSampled = () => { sampled = true }
  const threadBackoffs: { source: string; retryAt: Date }[] = []
  function add(feed: PublishedFeed, key: string, label: string, verifyTopicDates = false) {
    const origin = new URL(feed.url).origin
    tasks.push({ key, label, async read() {
      let permission = rules.get(origin)
      if (!permission) { permission = publisherRules(origin); rules.set(origin, permission) }
      const policy = await permission
      const rows = await readFeed(feed, since, policy, markSampled)
      if (!verifyTopicDates) return rows
      // bbPress all-topics uses last-active timestamps. Read the thread feed for
      // the actual datestamped entries of at most two recently active discussions.
      if (rows.length > 2) markSampled()
      const results = await Promise.allSettled(rows.slice(0, 2).map(async row => {
        const topic = new URL(row.url)
        topic.search = ''
        topic.hash = ''
        topic.pathname = topic.pathname.replace(/\/?$/, '/feed/')
        const entries = await readFeed({ ...feed, url: topic.href, entries: 'wordpress-posts' }, since, policy, markSampled)
        return entries.filter(post => new URL(post.url).pathname === new URL(row.url).pathname)
      }))
      const verified: NormalizedPost[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') verified.push(...result.value)
        else {
          markSampled()
          if (results.every(result => result.status === 'rejected')) throw result.reason
          if (result.reason instanceof ProviderBackoff) threadBackoffs.push({ source: key, retryAt: result.reason.retryAt })
        }
      }
      return verified
    } })
  }
  for (const [i, community] of communities.entries()) {
    const key = keys[i]
    add(community, key, community.community)
    if (community.entries === 'discourse-posts' && Date.now() - since.getTime() >= 3600000) {
      // When 50 individual replies have filled the activity feed, topic-only RSS
      // can still contain older openings inside the chosen hour/day.
      add({ ...community, url: new URL('/latest.rss?order=created', community.url).href, entries: undefined }, key, community.community + ' topics')
    } else if (community.entries === 'wordpress-posts') {
      add({ ...community, url: 'https://wordpress.org/support/view/all-topics/feed/', entries: undefined }, key, 'WordPress topics', true)
    }
  }
  const result = await collectFeeds(tasks, cooldowns)
  return { ...result, backoffs: [...result.backoffs, ...threadBackoffs], partial: sampled || result.unavailable.length > 0 }
}

export function fetchShopifyResearchCandidates(since: Date, cooldowns: ReadonlyMap<string, number> = new Map()) {
  return liveFeeds(shopifyFeeds, shopifyFeedKeys, since, cooldowns)
}

const livePublicFeeds: PublishedFeed[] = [
  { ...feeds[0], url: 'https://forum.bubble.io/posts.rss', entries: 'discourse-posts' },
  feeds[1], feeds[2],
]
export function fetchForumResearchCandidates(since: Date, cooldowns: ReadonlyMap<string, number> = new Map()) {
  return liveFeeds(livePublicFeeds, forumFeedKeys, since, cooldowns)
}
