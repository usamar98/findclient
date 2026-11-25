import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateScanPost, localIntent, ScoringError, scoringIssue, type ScoringIssue } from '../lib/scan-scoring'
import { isPendingScanState, scanOutcomeLabel } from '../lib/scan-outcomes'
import type { NormalizedPost } from '../lib/sources/shared'
import { APIConnectionTimeoutError } from 'openai/core/error'

const niche = { skill: 'Software Engineer', keywords: ['software engineer', 'looking to hire'] }
const post: NormalizedPost = {
  title: 'Ask HN: Who is hiring? (November 2026)', source: 'hn', url: 'https://news.ycombinator.com/item?id=12345',
  author: 'fixture', posted_at: '2026-11-26T01:00:00Z',
  body: 'We’re looking to hire a software engineer this week. Our budget is $2,000.',
}

test('an unavailable AI project evaluates the full candidate snapshot and only matches explicit relevant requests', async () => {
  let providerIssue: ScoringIssue | undefined
  let providerCalls = 0
  let matches = 0
  for (let index = 0; index < 18; index++) {
    const candidate = index === 17 ? post : { ...post, body: 'I published a software engineering tutorial.' }
    const result = await evaluateScanPost(candidate, niche, providerIssue, async () => {
      providerCalls++
      throw Object.assign(new Error('Provider error'), { status: 429, code: 'insufficient_quota' })
    })
    assert.equal(result.issue, 'quota')
    providerIssue = result.providerIssue
    if (result.rating) {
      matches++
      assert.ok(post.body.includes(result.rating.evidence.request))
      assert.match(result.rating.reason, /Text-based scoring/)
    }
  }
  assert.equal(providerCalls, 1)
  assert.equal(matches, 1)
})

test('one malformed response is evaluated locally while subsequent posts can use the AI', async () => {
  const first = await evaluateScanPost(post, niche, undefined, async () => {
    throw new ScoringError('invalid_response', 'Invalid evidence')
  })
  assert.equal(first.issue, 'invalid_response')
  assert.equal(first.providerIssue, undefined)
  const aiRating = { ...first.rating!, reason: 'Confirmed using fixture scorer' }
  const second = await evaluateScanPost(post, niche, first.providerIssue, async () => aiRating)
  assert.equal(second.rating, aiRating)
  assert.equal(second.issue, undefined)
  await assert.rejects(evaluateScanPost(post, niche, undefined, async () => { throw Error('unexpected internal error') }), /unexpected internal error/)
})

test('text-only scorer requires an open buyer request and a concrete service match', () => {
  for (const body of [
    'Hire me! I am a software engineer looking for a job.', 'We are not currently hiring a software engineer.',
    'Is anyone hiring a software engineer?', 'We are hiring a photographer for our shop.',
    'Looking to hire a software engineer for an unpaid project.', 'Our software engineer completed the release.',
    'We were looking to hire a software engineer. The position is filled.',
    "We aren't hiring a software engineer.", 'A guide to hiring a software engineer.',
  ]) assert.equal(localIntent({ ...post, body }, niche), null, body)
  assert.equal(localIntent({ ...post, title: 'Looking to hire', body: 'Looking to hire a painter.' }, { skill: 'Gardening', keywords: ['looking to hire', 'paid project'] }), null)
  assert.ok(localIntent(post, niche)!.score >= 75)
})

test('receipt states distinguish an active continuation from an exhausted retry and use safe provider categories', () => {
  assert.equal(scoringIssue({ status: 401 }), 'auth')
  assert.equal(scoringIssue({ status: 403 }), 'auth')
  assert.equal(scoringIssue({ status: 404 }), 'model')
  assert.equal(scoringIssue({ status: 429 }), 'unavailable')
  assert.equal(scoringIssue(new APIConnectionTimeoutError({})), 'unavailable')
  assert.equal(scoringIssue({ code: '42501' }), undefined)
  for (const state of ['queued', 'running', 'retry_source', 'retry_upgrade', 'continuing_local_quota']) assert.ok(isPendingScanState(state))
  assert.match(scanOutcomeLabel('retry_upgrade'), /migration/)
  for (const state of ['complete', 'failed_source', 'upgrade_required', 'local_quota']) assert.ok(!isPendingScanState(state))
  assert.match(scanOutcomeLabel('continuing_local_quota'), /Continuing.*quota/)
  assert.match(scanOutcomeLabel('local_auth'), /Completed.*credentials/)
})
