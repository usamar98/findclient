'use client'

import Link from 'next/link'
import { useState } from 'react'
import { trackJob } from '@/app/app/jobs/actions'
import type { JobTracking, TrackableJob } from '@/lib/job-tracking-model'
import { researchSourceLabels } from '@/lib/research-catalog'
import './job-actions.css'

export function JobActions({ job, proof, initialTracking }: { job: TrackableJob; proof: string; initialTracking?: JobTracking }) {
  const [updated, setUpdated] = useState<JobTracking>()
  const [pending, setPending] = useState<'save' | 'applied' | null>(null)
  const [error, setError] = useState('')
  const tracking = initialTracking?.appliedAt ? initialTracking : updated ?? initialTracking

  async function update(intent: 'save' | 'applied') {
    setPending(intent)
    setError('')
    try {
      const result = await trackJob(job, intent, proof)
      if (result.ok) setUpdated(result.tracking)
      else setError(result.error)
    } catch {
      setError('Could not update your inbox. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return <div className="job-actions">
    <div className="job-action-row">
      <a className="job-apply" href={job.url} target="_blank" rel="noopener noreferrer"
        aria-label={`Apply on ${researchSourceLabels[job.source]} (opens in a new tab)`}>
        Apply <span aria-hidden="true">↗</span>
      </a>
      {tracking
        ? <Link className="job-follow-up" href={`/app/leads/${tracking.leadId}#pipeline`} prefetch={false}>Follow up in inbox</Link>
        : <button type="button" disabled={pending !== null} onClick={() => update('save')}>
          {pending === 'save' ? 'Saving…' : 'Save to inbox'}
        </button>}
      {tracking?.appliedAt
        ? <span className="job-applied"><span aria-hidden="true">✓</span> Applied</span>
        : <button className="job-mark" type="button" disabled={pending !== null} onClick={() => update('applied')}>
          {pending === 'applied' ? 'Marking…' : 'Mark as applied'}
        </button>}
    </div>
    <span className="sr-only" role="status">{tracking && (tracking.appliedAt ? 'Job marked as applied in your inbox.' : 'Job saved to your inbox.')}</span>
    {error && <p role="alert">{error}</p>}
  </div>
}
