import type { ResearchPost } from './live-research'

export type TrackableJob = Pick<ResearchPost, 'source' | 'url' | 'title' | 'author' | 'posted_at' | 'excerpt' | 'compensation'>
export type JobTracking = { leadId: string; appliedAt: string | null }
