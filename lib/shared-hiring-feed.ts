import 'server-only'
import { createHash } from 'node:crypto'
import { admin } from './db/admin'
import { missingDatabaseResource } from './db/missing-resource'
import type { HiringObservation } from './db/schema'
import type { JobListing } from './research-catalog'
import type { ResearchStatus } from './live-research'
import { ProviderBackoff } from './sources/shared'
import { readHiringSource } from './sources/shared-hiring'

type Source = 'hn' | 'bluesky'
type ScanStatus = 'checked' | 'access' | 'cooldown' | 'unavailable'
type SharedFeed = {
  source: Source; status: ResearchStatus; indexed: false; posts: JobListing[]
  partial: boolean; lastCheckedAt?: string
}
const sharedSources: Source[] = ['hn', 'bluesky']
const day = 86_400_000
const readLimit = 500

// These four sources are read directly. Store only their identity and dates.
// Including the publication date distinguishes a genuinely re-issued listing.
export async function stampJobDiscoveries<T extends JobListing>(posts: T[]): Promise<Array<T & { first_found_at?: string }>> {
  if (!posts.length) return posts
  const jobs = posts.map(({ source, url, posted_at }) => ({
    source, url, posted_at,
    source_key: createHash('sha256').update(url + '\n' + new Date(posted_at).toISOString()).digest('hex'),
  }))
  const { data, error } = await admin().rpc('record_job_discoveries', { p_jobs: jobs })
  if (error) {
    if (!missingDatabaseResource(error, 'function', 'record_job_discoveries')) console.error('Job discovery timestamps unavailable', error.code)
    return posts
  }
  const dates = new Map(data.map(row => [row.source + '\n' + row.url, row.first_found_at]))
  return posts.map(post => ({ ...post, first_found_at: dates.get(post.source + '\n' + post.url) }))
}

export async function refreshSharedHiringFeed(sources: Source[] = sharedSources) {
  const db = admin()
  const { data, error } = await db.rpc('claim_shared_hiring_sources', { p_sources: sources })
  if (missingDatabaseResource(error, 'function', 'claim_shared_hiring_sources')) return { status: 'migration_required', sources: [] }
  if (error) throw error
  const since = new Date(Date.now() - day)
  const refreshed = await Promise.all(data.map(async ({ source, lease_id }) => {
    let posts: HiringObservation[] = []
    let partial = true
    let status: ScanStatus = 'checked'
    let retryAt: Date | undefined
    let withdrawn: string[] = []
    try {
      const result = await readHiringSource(source, since)
      posts = result.posts.map(({ source_id, url, posted_at, title, body, author, engagement, compensation }) => ({
        source, source_key: source_id, url, posted_at, listing: { title, body, author, engagement, compensation },
      }))
      partial = result.partial
      retryAt = result.retryAt
      withdrawn = result.withdrawn ?? []
    } catch (cause) {
      if (cause instanceof ProviderBackoff) {
        status = 'cooldown'
        retryAt = cause.retryAt
      } else {
        status = cause instanceof Error && /^Source returned HTTP (401|403)$/.test(cause.message) ? 'access' : 'unavailable'
      }
    }
    const saved = await db.rpc('complete_shared_hiring_source', {
      p_source: source, p_lease: lease_id, p_status: status, p_partial: partial,
      p_retry_at: retryAt?.toISOString() ?? null, p_jobs: posts, p_withdrawn: withdrawn,
    })
    if (saved.error) throw saved.error
    return { source, status: saved.data ? status : 'lease_expired', observed: saved.data ? posts.length : 0, partial }
  }))
  return { status: 'ready', sources: refreshed }
}

export async function readSharedHiringFeed(sources: Source[], since: Date): Promise<SharedFeed[]> {
  if (!sources.length) return []
  const selected = [...new Set(sources)]
  // A first visit can populate an empty feed. Cron and readers share the same leases.
  try {
    await refreshSharedHiringFeed(selected)
  } catch {
    console.error('Shared hiring refresh unavailable; reading the last saved jobs')
  }
  const db = admin()
  const { data: states, error } = await db.from('shared_hiring_sources')
    .select('source,status,partial,last_checked_at,last_success_at').in('source', selected)
  const now = Date.now()
  const start = new Date(Math.max(since.getTime(), now - day)).toISOString()
  return Promise.all(selected.map(async (source): Promise<SharedFeed> => {
    const empty: SharedFeed = { source, status: 'unavailable', indexed: false, posts: [], partial: true }
    const state = states?.find(state => state.source === source)
    if (error || !state) return empty
    const rows = await db.from('shared_hiring_jobs').select('url,posted_at,first_found_at,listing')
      .eq('source', source).not('listing', 'is', null).gte('posted_at', start).lte('posted_at', new Date(now).toISOString())
      .order('posted_at', { ascending: false }).order('source_key').limit(readLimit + 1)
    if (rows.error) return empty
    const posts: JobListing[] = []
    for (const row of rows.data.slice(0, readLimit)) {
      if (!row.listing) continue
      const { title, body, author, tags, engagement, compensation } = row.listing
      const job = { source, title, body, author, tags, url: row.url, posted_at: row.posted_at, first_found_at: row.first_found_at }
      posts.push(engagement === 'paid_freelance' ? { ...job, engagement, compensation } : { ...job, engagement })
    }
    const stale = !state.last_success_at || now - Date.parse(state.last_success_at) > 3 * 60_000
    return { source, status: state.status, indexed: false, posts,
      partial: state.partial || stale || state.status !== 'checked' || rows.data.length > readLimit,
      lastCheckedAt: state.last_checked_at ?? undefined }
  }))
}

export async function pruneHiringHistory() {
  const { error } = await admin().from('shared_hiring_jobs').delete().lt('posted_at', new Date(Date.now() - 7 * day).toISOString())
  if (error && !missingDatabaseResource(error, 'table', 'shared_hiring_jobs')) throw error
}
