import 'server-only'
import { createHash } from 'node:crypto'
import { admin } from './db/admin'
import { missingDatabaseResource } from './db/missing-resource'
import type { ScanJob } from './db/schema'
import { adapters, providerKey, type NormalizedPost } from './sources'
import { scoreIntent } from './ai'
import { nicheSchema } from './niche'
import { assessBuyer, closedRequest } from './lead-intelligence'
import { verifyLeadSource } from './verify-lead-source'

const week = 7 * 86400000
function validPost(post: NormalizedPost, since: Date, negative: string[]) {
  const timestamp = Date.parse(post.posted_at)
  if (
    !Number.isFinite(timestamp) ||
    timestamp < since.valueOf() ||
    timestamp > Date.now() + 5 * 60_000
  )
    return false
  try {
    const url = new URL(post.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  } catch {
    return false
  }
  const words =
    ' ' +
    (post.title + ' ' + post.body)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ') +
    ' '
  return !negative.some((phrase) =>
    words.includes(
      ' ' +
        phrase
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim() +
        ' ',
    ),
  )
}
async function runJob(job: ScanJob, deadline: number) {
  const service = admin()
  if (!job.lease || !job.run_id) return { scored: 0, inserted: 0, outcome: 'skipped' }
  const { data: run, error } = await service
    .from('scan_runs')
    .select('credit_limit,niches!inner(*,profiles(credits,fast_discovery))')
    .eq('id', job.run_id)
    .maybeSingle()
  if (error) throw error
  const row = run?.niches
  const source = job.source as keyof typeof adapters
  if (
    !row || (!row.active && run.credit_limit === null) ||
    !row.sources.some((s) => s === source) || !row.profiles
  )
    return { scored: 0, inserted: 0, outcome: 'skipped' }
  const allowance = await service.rpc('scan_allowance', { p_run: job.run_id })
  if (allowance.error) throw allowance.error
  if (!allowance.data) return { scored: 0, inserted: 0, outcome: 'limited' }
  if (providerKey(source) === 'exa' && !process.env.EXA_API_KEY)
    return { scored: 0, inserted: 0, outcome: 'missing_exa' }
  if (!process.env.OPENAI_API_KEY)
    return { scored: 0, inserted: 0, outcome: 'missing_scorer' }
  const niche = nicheSchema.parse({
    ...row,
    portfolio_url: row.portfolio_url ?? '',
  })
  const since = new Date(Date.now() - week)
  const cadence =
    row.profiles.fast_discovery && ['hn', 'bluesky', 'shopify'].includes(source)
      ? 600000
      : 3600000
  const slot = Math.floor(Date.parse(job.scan_hour) / cadence)
  const phrase = niche.keywords[slot % niche.keywords.length] || niche.skill
  const adapter = adapters[source]
  let candidates = job.candidates
  if (candidates === null) {
    candidates = await adapter.search(phrase, since, niche)
    // Keep the same set of URLs on continuation and avoid another provider charge.
    const snapshot = await service.from('scan_jobs').update({ candidates })
      .eq('id', job.id).eq('lease', job.lease).select('id').maybeSingle()
    if (snapshot.error) throw snapshot.error
    if (!snapshot.data) return { scored: 0, inserted: 0, outcome: 'skipped' }
  }
  const posts = Array.from(
    new Map(
      candidates
        .filter(
          (p) =>
            validPost(p, since, niche.negative_keywords) &&
            !closedRequest(p.title + ' ' + p.body),
        )
        .map((p) => [p.url, p]),
    ).values(),
  )
  if (!posts.length) return { scored: 0, inserted: 0, outcome: 'complete' }
  const [existing, feedback] = await Promise.all([
    service
      .from('leads')
      .select('url')
      .eq('user_id', row.user_id)
      .in(
        'url',
        posts.map((p) => p.url),
      ),
    service
      .from('leads')
      .select('title,match_feedback')
      .eq('niche_id', row.id)
      .not('match_feedback', 'is', null)
      .order('match_feedback_at', { ascending: false })
      .limit(6),
  ])
  if (existing.error) throw existing.error
  if (feedback.error) throw feedback.error
  const recorded = new Set(existing.data.map((item) => item.url))
  let scored = 0,
    inserted = 0,
    outcome = 'complete'
  for (const post of posts) {
    if (Date.now() > deadline) throw new Error('Continuation needed')
    if (recorded.has(post.url)) continue
    const key =
      'score:' +
      createHash('sha256')
        .update(row.id + '\n' + post.url)
        .digest('hex')
    const reservation = await service.rpc('reserve_scan_score', {
      p_job: job.id, p_lease: job.lease, p_key: key,
    })
    if (reservation.error) throw reservation.error
    if (reservation.data === 'duplicate') continue
    if (reservation.data !== 'reserved') {
      outcome = reservation.data === 'limited' ? 'limited' : 'skipped'
      break
    }
    try {
      const rating = await scoreIntent(
        post,
        niche.skill,
        niche.keywords,
        feedback.data,
      )
      const verification =
        rating.score >= niche.min_intent
          ? await verifyLeadSource(post, true)
          : null
      const lead =
        verification && verification.availability.state !== 'closed'
          ? {
              niche_id: row.id,
              source: post.source,
              url: post.url,
              author: post.author,
              title: post.title,
              body: post.body,
              posted_at: post.posted_at,
              intent_score: rating.score,
              intent_reason: rating.reason,
              problem_summary: rating.problem_summary,
              budget_signal: rating.budget_signal,
              urgency: rating.urgency,
              buyer_intelligence: assessBuyer(
                post,
                rating,
                verification.accountCreated,
                verification.availability,
                verification.profileSite,
              ),
            }
          : null
      const result = await service.rpc('finalize_scan_score', {
        p_user: row.user_id,
        p_key: key,
        p_lead: lead,
      })
      if (result.error) throw result.error
      scored++
      if (result.data) inserted++
    } catch (error) {
      const refund = await service.rpc('refund_usage', {
        p_user: row.user_id,
        p_key: key,
      })
      if (refund.error) throw refund.error
      throw error
    }
  }
  return { scored, inserted, outcome }
}
export async function runEngine(enqueue = true, runId?: string) {
  const service = admin(),
    stats = { queued: 0, jobs: 0, scored: 0, inserted: 0, retrying: 0 }
  if (!runId) {
    // A deployment and its SQL upgrade can land at different times. Leave legacy jobs unclaimed.
    const { error } = await service.from('scan_runs').select('id').limit(0)
    if (missingDatabaseResource(error, 'table', 'scan_runs')) {
      return { ...stats, deferred: 'workspace_schema_pending' }
    }
    if (error) throw error
  }
  if (enqueue) {
    const [enqueueResult, legacy] = await Promise.all([
      service.rpc('enqueue_scans'),
      service
        .from('leads')
        .select('id,title,body,url,posted_at')
        .is('buyer_intelligence', null)
        .order('created_at', { ascending: false })
        .limit(25),
    ])
    if (enqueueResult.error) throw enqueueResult.error
    if (legacy.error) throw legacy.error
    const saved = await Promise.all(
      legacy.data.map((lead) =>
        service
          .from('leads')
          .update({ buyer_intelligence: assessBuyer(lead) })
          .eq('id', lead.id)
          .is('buyer_intelligence', null),
      ),
    )
    for (const write of saved) if (write.error) throw write.error
    stats.queued = enqueueResult.data ?? 0
  }
  const deadline = Date.now() + 45000
  const batch = runId
    ? await service.rpc('claim_run_scan_jobs', { p_run: runId, p_limit: 8 })
    : await service.rpc('claim_scan_jobs', { p_limit: 4 })
  if (batch.error) throw batch.error
  await Promise.all(
    (batch.data ?? []).map(async (job) => {
      if (!job.lease) return
      if (!job.run_id) {
        // A claim using a stale API schema must never mark a source as scanned.
        const release = await service.from('scan_jobs').update({
          lease: null, available_at: new Date(Date.now() + 60_000).toISOString(),
        }).eq('id', job.id).eq('lease', job.lease)
        if (release.error) throw release.error
        stats.retrying++
        return
      }
      let changes: { done_at: string; outcome: string } | { available_at: string; outcome: string }
      try {
        const { scored, inserted, outcome } = await runJob(job, deadline)
        stats.scored += scored
        stats.inserted += inserted
        stats.jobs++
        const time = new Date().toISOString()
        const marked = await service
          .from('niches')
          .update({ last_scanned_at: time })
          .eq('id', job.niche_id)
        if (marked.error) throw marked.error
        changes = { done_at: time, outcome }
      } catch (problem) {
        const retry =
          problem &&
          typeof problem === 'object' &&
          'retryAt' in problem &&
          problem.retryAt instanceof Date
            ? problem.retryAt
            : null
        if (retry && Number.isFinite(retry.valueOf())) {
          const throttled = await service.rpc('defer_source', {
            p_source: providerKey(job.source),
            p_until: retry.toISOString(),
          })
          if (throttled.error) throw throttled.error
        }
        const delay =
          problem instanceof Error && problem.message === 'Continuation needed'
            ? 5
            : Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7))
        changes = {
          outcome: 'retrying',
          available_at: new Date(
            Math.max(Date.now() + delay * 1000, retry?.valueOf() ?? 0),
          ).toISOString(),
        }
        stats.retrying++
        console.warn('Scan job deferred', {
          job: job.id,
          source: job.source,
          attempt: job.attempts,
        })
      }
      const save = await service
        .from('scan_jobs')
        .update({ ...changes, lease: null })
        .eq('id', job.id)
        .eq('lease', job.lease)
      if (save.error) throw save.error
    }),
  )
  return stats
}
