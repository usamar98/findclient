import { z } from 'zod'
import { researchMatchPlan } from '../research-matching'
import { readBlueskyPosts, readHnPosts, readStackQuestions } from './api'
import { readNewestHn } from './hn-latest'
import { apiURL, ProviderBackoff, remote, respectStackQuota, type NormalizedPost } from './shared'

type Network = 'hn' | 'bluesky' | 'stackexchange'
type Request = { term: string; cursor?: string }
type Page = { posts: NormalizedPost[]; next?: string; retryAt?: Date }

const hnResponse = z.object({ hits: z.array(z.unknown()), page: z.number(), nbPages: z.number() })
const blueskyResponse = z.object({ posts: z.array(z.unknown()), cursor: z.string().optional() })
const stackResponse = z.object({
  items: z.array(z.unknown()), has_more: z.boolean(),
  backoff: z.number().optional(), quota_remaining: z.number().optional(),
})
const shortWindow = 16 * 60_000

async function networkPage(source: Network, request: Request, since: Date): Promise<Page> {
  // Share recent-stream reads across search terms and users. Short bucketed
  // cutoffs retain new arrivals; the provider's original date is checked below.
  const sharedSince = Math.floor(since.getTime() / 30_000) * 30
  if (source === 'hn') {
    const url = apiURL('https://hn.algolia.com/api/v1/search_by_date', {
      query: request.term, page: request.cursor ?? '0', hitsPerPage: '80',
      numericFilters: 'created_at_i>=' + sharedSince,
    })
    const data = hnResponse.parse(await (await remote(url, { next: { revalidate: 20 } })).json())
    return {
      posts: readHnPosts(data.hits, since),
      next: data.hits.length && data.page + 1 < data.nbPages ? String(data.page + 1) : undefined,
    }
  }
  if (source === 'bluesky') {
    const url = apiURL('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts', {
      q: request.term, since: new Date(sharedSince * 1000).toISOString(), sort: 'latest', limit: '60',
    })
    if (request.cursor) url.searchParams.set('cursor', request.cursor)
    const data = blueskyResponse.parse(await (await remote(url, { next: { revalidate: 20 } })).json())
    return {
      posts: readBlueskyPosts(data.posts, since),
      next: data.posts.length ? data.cursor : undefined,
    }
  }
  // The /questions listing exposes questions by creation date before the free
  // text search index necessarily returns them. One minute is Stack's minimum
  // recommended cache interval for semantically identical requests.
  const url = apiURL('https://api.stackexchange.com/2.3/' + (request.term ? 'search/advanced' : 'questions'), {
    site: 'stackoverflow', sort: 'creation', order: 'desc', filter: 'withbody',
    page: request.cursor ?? '1', pagesize: '50', fromdate: String(Math.floor(since.getTime() / 60_000) * 60),
  })
  if (request.term) {
    url.searchParams.set('q', request.term)
    url.searchParams.set('closed', 'false')
  }
  if (process.env.STACK_EXCHANGE_KEY) url.searchParams.set('key', process.env.STACK_EXCHANGE_KEY)
  const data = stackResponse.parse(await (await remote(url, { next: { revalidate: 60 } })).json())
  const posts = readStackQuestions(data.items, since)
  try {
    respectStackQuota(data)
  } catch (error) {
    // Stack can return valid rows and a request to back off in the same response.
    if (error instanceof ProviderBackoff) return { posts, retryAt: error.retryAt }
    throw error
  }
  return { posts, next: data.has_more && data.items.length ? String(Number(request.cursor ?? 1) + 1) : undefined }
}

async function searchPages(source: Network, query: string, since: Date, readStream: boolean) {
  const variants = researchMatchPlan(query).queries
  const requests: Request[] = (readStream ? [''] : variants).map(term => ({ term }))
  const maximumReads = source === 'stackexchange' ? 3 : 4
  const visited = new Set<string>()
  const posts = new Map<string, NormalizedPost>()
  let successes = 0, partial = false
  let lastError: unknown
  let retryAt: Date | undefined
  for (let i = 0; i < requests.length && visited.size < maximumReads; i++) {
    const request = requests[i]
    const key = JSON.stringify(request)
    if (visited.has(key)) continue
    visited.add(key)
    try {
      const page = await networkPage(source, request, since)
      successes++
      for (const post of page.posts) posts.set(post.url, post)
      if (page.retryAt) {
        retryAt = page.retryAt
        partial = true
        break
      }
      if (page.next) requests.push({ term: request.term, cursor: page.next })
      if (page.next && page.next === request.cursor) partial = true
    } catch (error) {
      lastError = error
      partial = true
      if (error instanceof ProviderBackoff) { retryAt = error.retryAt; break }
      // A failed listing should not hide matches the search endpoint can return.
      if (request.term === '' && !request.cursor) requests.push(...variants.map(term => ({ term })))
    }
  }
  if (!successes) throw lastError ?? new Error('Source search unavailable.')
  partial ||= requests.some(request => !visited.has(JSON.stringify(request)))
  return {
    posts: [...posts.values()].sort((a, b) => b.posted_at.localeCompare(a.posted_at)),
    partial, retryAt,
  }
}

export async function searchKeylessNetwork(source: Network, query: string, since: Date) {
  const readStream = source !== 'bluesky' && Date.now() - since.getTime() <= shortWindow
  const pages = searchPages(source, query, since, readStream)
  if (source !== 'hn' || !readStream) return pages

  const [index, newest] = await Promise.allSettled([pages, readNewestHn(since)])
  const failures = [index, newest].flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  const indexed = index.status === 'fulfilled' ? index.value : undefined
  const direct = newest.status === 'fulfilled' ? newest.value : undefined
  const retryAt = [indexed?.retryAt, direct?.retryAt, ...failures.map(error => error instanceof ProviderBackoff ? error.retryAt : undefined)]
    .filter((date): date is Date => !!date).sort((a, b) => +b - +a)[0]
  if (!indexed && !direct) throw retryAt ? new ProviderBackoff(retryAt) : failures[0]

  const combined = new Map<string, NormalizedPost>()
  let overlapsIndex = false
  for (const post of indexed?.posts ?? []) {
    if (direct && Number(new URL(post.url).searchParams.get('id')) >= direct.firstId) overlapsIndex = true
    if (!direct?.excluded.has(post.url)) combined.set(post.url, post)
  }
  for (const post of direct?.posts ?? []) combined.set(post.url, post)
  return {
    posts: [...combined.values()].sort((a, b) => b.posted_at.localeCompare(a.posted_at)),
    partial: !indexed || !direct || indexed.partial || direct.partial || (!direct.reachedCutoff && !overlapsIndex),
    retryAt,
  }
}
