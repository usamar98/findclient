import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { researchSources } from './research-catalog'
import type { TrackableJob } from './job-tracking-model'

const listing = z.object({
  source: z.enum(researchSources),
  url: z.url({ protocol: /^https$/ }).max(2000),
  title: z.string().min(1).max(2000),
  author: z.string().max(1000),
  posted_at: z.iso.datetime({ offset: true }),
  excerpt: z.string().max(16000),
  compensation: z.string().max(1000).optional(),
})

// The same public listing can be saved by multiple users. The authenticated
// server action determines the owner, never the browser or the proof.
export function signTrackingJob(job: TrackableJob, secret: string) {
  const message = JSON.stringify(['track-job-v1', job.source, job.url, job.title, job.author,
    job.posted_at, job.excerpt, job.compensation ?? null])
  return createHmac('sha256', secret).update(message).digest('base64url')
}

export function verifiedTrackingJob(input: unknown, proof: unknown, secret: string) {
  if (typeof proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(proof)) return null
  const job = listing.safeParse(input)
  if (!job.success) return null
  const url = new URL(job.data.url)
  if (url.username || url.password || url.port) return null
  const signature = signTrackingJob(job.data, secret)
  return timingSafeEqual(Buffer.from(signature), Buffer.from(proof)) ? job.data : null
}
