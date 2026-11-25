import robotsParser from 'robots-parser'
import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'
import { cleanPosts, plain, ProviderBackoff, remote, type Adapter, type NormalizedPost } from './shared'

type PublishedFeed = {
  url: string
  postPath: RegExp
  source: 'shopify' | 'forums'
  community: string
}
const discourseTopic = /^\/t\/(?:[^/]+\/)?\d+\/?$/
const feeds = [
  { community: 'Bubble', url: 'https://forum.bubble.io/latest.rss?order=created', postPath: discourseTopic, source: 'forums' },
  { community: 'WordPress', url: 'https://wordpress.org/support/view/all-topics/feed/', postPath: /^\/support\/topic\/[^/]+\/?$/, source: 'forums' },
  { community: 'Webflow', url: 'https://community.webflow.com/rss/feed', postPath: /^\/[^/]+\/post\/[^/]+\/?$/, source: 'forums' },
] as const satisfies readonly PublishedFeed[]
export const forumFeedKeys = feeds.map(feed => 'forum:' + feed.community.toLowerCase())
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

async function searchFeed(feed: PublishedFeed, query: string, since: Date) {
  const origin = new URL(feed.url).origin
  const robotsUrl = origin + '/robots.txt'
  const headers = { 'User-Agent': 'LeadToClient/1.0 (community RSS reader)' }
  const robots = await remote(robotsUrl, { headers, next: { revalidate: 3600 } })
  const rules = robotsParser(robotsUrl, await bodyText(robots, 512000))
  const agents = ['LeadToClient', 'Clientfind']
  if (agents.some(agent => rules.isAllowed(feed.url, agent) !== true)) throw new FeedAccessRestricted()
  const cacheSeconds = Math.max(60, ...agents.map(agent => rules.getCrawlDelay(agent) ?? 0))
  const response = await remote(feed.url, { headers, next: { revalidate: cacheSeconds } })
  const xml = await bodyText(response, 2_000_000)
  if (/<!DOCTYPE/i.test(xml)) throw new Error('Invalid feed.')
  const rows = channel.parse(xmlParser.parse(xml)).rss.channel.item
  const words = query.toLowerCase().split(/\s+/).filter(word => word && word !== feed.community.toLowerCase())
  const posts: NormalizedPost[] = []
  for (const row of rows) {
    const parsed = item.safeParse(row)
    if (!parsed.success) continue
    const p = parsed.data
    if (p['discourse:topicClosed'] === 'Yes' || p['discourse:topicArchived'] === 'Yes') continue
    const link = new URL(p.link)
    if (link.origin !== origin || !feed.postPath.test(link.pathname)) continue
    const body = p['content:encoded'] || p.description || ''
    const searchable = plain(p.title + ' ' + body).toLowerCase()
    if (!words.every(word => searchable.includes(word))) continue
    posts.push({
      source: feed.source, title: p.title, url: p.link, body,
      author: p['dc:creator'] ?? '', posted_at: p.pubDate,
    })
  }
  return cleanPosts(posts, since)
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
  const results = await Promise.allSettled(feeds.map((feed, i) => {
    if ((cooldowns.get(forumFeedKeys[i]) ?? 0) > Date.now()) return Promise.resolve(null)
    return searchFeed(feed, query, since)
  }))
  const checked: string[] = []
  const unavailable: string[] = []
  const backoffs: { source: string; retryAt: Date }[] = []
  const posts: NormalizedPost[] = []
  for (const [i, result] of results.entries()) {
    const community = feeds[i].community
    if (result.status === 'fulfilled' && result.value !== null) {
      checked.push(community)
      posts.push(...result.value)
    } else {
      unavailable.push(community)
      if (result.status === 'rejected' && result.reason instanceof ProviderBackoff) {
        backoffs.push({ source: forumFeedKeys[i], retryAt: result.reason.retryAt })
      }
    }
  }
  return { posts: cleanPosts(posts, since), checked, unavailable, backoffs }
}
