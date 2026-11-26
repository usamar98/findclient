'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { missingDatabaseResource } from '@/lib/db/missing-resource'
import type { JobTracking, TrackableJob } from '@/lib/job-tracking-model'
import { verifiedTrackingJob } from '@/lib/job-tracking-proof'

export async function trackJob(post: TrackableJob, intent: 'save' | 'applied', proof: string):
  Promise<{ ok: true; tracking: JobTracking } | { ok: false; error: string }> {
  const { user } = await requireUser()
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return { ok: false, error: 'Job tracking is temporarily unavailable.' }
  const listing = verifiedTrackingJob(post, proof, secret)
  if (!listing || !['save', 'applied'].includes(intent)) {
    return { ok: false, error: 'Please refresh the results and try this listing again.' }
  }
  const { data, error } = await admin().rpc('track_inbox_job', {
    p_owner: user.id, p_job: listing, p_applied: intent === 'applied',
  }).single()
  if (error) return { ok: false, error: missingDatabaseResource(error, 'function', 'track_inbox_job')
    ? 'Job tracking will be available after the database update. You can still open the original listing.'
    : 'Job tracking is unavailable. Please try again shortly.' }
  revalidatePath('/app/jobs')
  revalidatePath('/app/inbox')
  revalidatePath('/app/leads/' + data.id)
  revalidatePath('/app')
  return { ok: true, tracking: { leadId: data.id, appliedAt: data.applied_at } }
}
