import { z } from 'zod'
import { readHnPosts } from './api'
import { ProviderBackoff, remote } from './shared'

const base = 'https://hacker-news.firebaseio.com/v0/'
const batchSize = 8
const positiveInteger = z.number().int().positive()
const item = z.object({
  id: positiveInteger, time: positiveInteger.optional(), type: z.string().optional(),
  by: z.string().optional(), title: z.string().optional(), text: z.string().optional(),
  deleted: z.boolean().optional(), dead: z.boolean().optional(),
})

async function firebase(path: string) {
  // These URLs are identical across all users, keywords and time windows.
  return (await remote(new URL(path, base), { cache: 'force-cache', next: { revalidate: 10 } })).json()
}

/** Inspect the newest item IDs directly while the Algolia index catches up. */
export async function readNewestHn(since: Date) {
  const max = positiveInteger.parse(await firebase('maxitem.json'))
  const ids = Array.from({ length: Math.min(batchSize, max) }, (_, i) => max - i)
  const results = await Promise.allSettled(ids.map(async id => {
    const data = await firebase('item/' + id + '.json')
    if (data === null) return null
    const parsed = item.parse(data)
    if (parsed.id !== id) throw new Error('Unexpected Hacker News item ID.')
    return parsed
  }))
  const hits = []
  const excluded = new Set<string>()
  let reachedCutoff = max <= batchSize, partial = false, successes = 0
  let retryAt: Date | undefined, lastError: unknown
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      lastError = result.reason
      partial = true
      if (lastError instanceof ProviderBackoff && (!retryAt || lastError.retryAt > retryAt)) retryAt = lastError.retryAt
      continue
    }
    const data = result.value
    successes++
    const time = (data?.time ?? 0) * 1000
    if (time && time <= since.getTime()) reachedCutoff = true
    if (!data || data.dead || data.deleted) {
      excluded.add('https://news.ycombinator.com/item?id=' + ids[i])
      continue
    }
    if (!['story', 'comment', 'job'].includes(data.type ?? '') || !data.by?.trim() || !time ||
        time < since.getTime() || time > Date.now()) continue
    hits.push({
      objectID: String(data.id), author: data.by, created_at: new Date(time).toISOString(),
      title: data.type === 'comment' ? undefined : data.title,
      story_text: data.type === 'comment' ? undefined : data.text,
      comment_text: data.type === 'comment' ? data.text : undefined,
    })
  }
  if (!successes) throw retryAt ? new ProviderBackoff(retryAt) : lastError
  return { posts: readHnPosts(hits, since), excluded, firstId: ids[ids.length - 1], reachedCutoff, partial, retryAt }
}
