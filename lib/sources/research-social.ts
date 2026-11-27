import { z } from 'zod'
import { researchMatchPlan } from '../research-matching'
import { apiURL, cleanPosts, remote, type Adapter } from './shared'

// Both providers support OR groups. Keep secondary skill terms tied to buyer
// language so general chatter doesn't fill the single, rate-limited response.
function socialQuery(query: string, conjunction: ' ' | ' AND ') {
  const [original, ...related] = researchMatchPlan(query).queries
  if (!related.length) return query
  const alternatives = related.map(term => '"' + term + '"').join(' OR ')
  return '("' + original + '" OR ((' + alternatives + ')' + conjunction +
    '(hiring OR hire OR need OR help OR wanted OR contractor OR freelance)))'
}

const xResponse = z.object({
  meta: z.object({ result_count: z.number() }),
  data: z.array(z.unknown()).optional(),
  includes: z.object({ users: z.array(z.object({ id: z.string(), username: z.string() })).optional() }).optional(),
})
const xPost = z.object({
  id: z.string().regex(/^\d+$/), author_id: z.string(), created_at: z.iso.datetime({ offset: true }), text: z.string(),
  referenced_tweets: z.array(z.object({ type: z.string() })).optional(),
})

export const xRecent: Adapter = {
  async search(query, since) {
    const url = apiURL('https://api.x.com/2/tweets/search/recent', {
      query: socialQuery(query, ' ') + ' -is:retweet', sort_order: 'recency', start_time: since.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      'tweet.fields': 'created_at,author_id,referenced_tweets', expansions: 'author_id', 'user.fields': 'username', max_results: '10',
    })
    const response = await remote(url, { cache: 'no-store', headers: { Authorization: 'Bearer ' + process.env.X_BEARER_TOKEN } })
    const result = xResponse.parse(await response.json())
    const users = new Map(result.includes?.users?.map(user => [user.id, user.username]))
    return cleanPosts((result.data ?? []).flatMap(record => {
      const parsed = xPost.safeParse(record)
      if (!parsed.success) return []
      const post = parsed.data
      if (post.referenced_tweets?.some(tweet => tweet.type === 'retweeted')) return []
      const author = users.get(post.author_id)
      if (!author || !/^[a-z0-9_]{1,15}$/i.test(author)) return []
      return [{ source: 'x', url: 'https://x.com/' + author + '/status/' + post.id, author,
        title: post.text.slice(0, 180), body: post.text, posted_at: post.created_at }]
    }), since)
  },
}

const redditToken = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() })
const redditPost = z.object({
  kind: z.literal('t3'), data: z.object({
    id: z.string().regex(/^[a-z0-9]+$/i), subreddit: z.string().regex(/^[a-z0-9_]+$/i),
    title: z.string(), author: z.string(), selftext: z.string().default(''), created_utc: z.number().positive(),
    crosspost_parent: z.string().nullish(), removed_by_category: z.string().nullish(),
  }),
})
let cachedToken: { value: string; expiresAt: number } | undefined
let tokenRequest: Promise<string> | undefined
async function getRedditToken(userAgent: string) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  if (!tokenRequest) tokenRequest = (async () => {
    const basic = Buffer.from(process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET).toString('base64')
    const response = await remote('https://www.reddit.com/api/v1/access_token', {
      method: 'POST', cache: 'no-store', body: new URLSearchParams({ grant_type: 'client_credentials' }),
      headers: { Authorization: 'Basic ' + basic, 'User-Agent': userAgent },
    })
    const token = redditToken.parse(await response.json())
    cachedToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 }
    return cachedToken.value
  })().finally(() => { tokenRequest = undefined })
  return tokenRequest
}

export const redditRecent: Adapter = {
  async search(query, since) {
    const userAgent = process.env.REDDIT_USER_AGENT!
    const token = await getRedditToken(userAgent)
    const url = apiURL('https://oauth.reddit.com/search', {
      q: socialQuery(query, ' AND '), sort: 'new', t: 'day', type: 'link', limit: '25', raw_json: '1',
    })
    let result: Response
    try {
      result = await remote(url, { cache: 'no-store', headers: { Authorization: 'Bearer ' + token, 'User-Agent': userAgent } })
    } catch (error) {
      if (error instanceof Error && error.message === 'Source returned HTTP 401') cachedToken = undefined
      throw error
    }
    const listing = z.object({ data: z.object({ children: z.array(z.unknown()) }) }).parse(await result.json())
    return cleanPosts(listing.data.children.flatMap(record => {
      const parsed = redditPost.safeParse(record)
      if (!parsed.success) return []
      const p = parsed.data.data
      if (p.crosspost_parent || p.removed_by_category) return []
      const published = new Date(p.created_utc * 1000)
      if (!Number.isFinite(published.getTime()) || p.selftext === '[removed]' || p.selftext === '[deleted]') return []
      return [{ source: 'reddit', url: 'https://www.reddit.com/r/' + p.subreddit + '/comments/' + p.id + '/',
        title: p.title, body: p.selftext, author: p.author, posted_at: published.toISOString() }]
    }), since)
  },
}
