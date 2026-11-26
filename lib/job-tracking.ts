import 'server-only'
import { requireUser } from './db/server'
import type { JobTracking, TrackableJob } from './job-tracking-model'
import { signTrackingJob } from './job-tracking-proof'

export function jobTrackingProof(post: TrackableJob) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  return secret ? signTrackingJob(post, secret) : ''
}

export async function getJobTracking(posts: { url: string }[]): Promise<Record<string, JobTracking>> {
  const urls = [...new Set(posts.map(post => post.url))]
  if (!urls.length) return {}
  const { db } = await requireUser()
  const { data, error } = await db.rpc('get_job_tracking', { p_urls: urls })
  if (error) return {} // Listings stay usable if the tracking migration is pending.
  return Object.fromEntries(data.map(row => [row.url, { leadId: row.id, appliedAt: row.applied_at }]))
}
