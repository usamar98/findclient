import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/db/schema'
import { advancedFiltersActive, inboxHref, parseInboxFilters } from '../lib/inbox-filters'
import { queryInbox } from '../lib/inbox-query'

test('preserves legacy filter URLs and repeated selections through pagination', () => {
  const filters = parseInboxFilters({ source: ['reddit', 'hn', 'reddit', 'bogus'], status: ['saved', 'new'], q: ' form ', sort: 'buyer', due: 'yes' })
  const params = new URL(inboxHref(filters, 3), 'https://example.com').searchParams
  assert.deepEqual(params.getAll('source'), ['hn', 'reddit'])
  assert.deepEqual(params.getAll('status'), ['new', 'saved'])
  assert.equal(params.get('q'), 'form')
  assert.equal(params.get('page'), '3')
  assert.equal(params.get('due'), 'yes')
  assert.equal(params.get('sort'), 'buyer')
  assert.equal(inboxHref(parseInboxFilters({ source: 'hn', status: 'new' })), '/app/inbox?source=hn&status=new')
  const empty = parseInboxFilters({ q: ' ', source: 'bad', status: '', sort: 'bad', quality: '101', value: '-3', page: '0' })
  assert.equal(inboxHref(empty), '/app/inbox')
  assert.equal(advancedFiltersActive(empty), false)
  assert.equal(advancedFiltersActive(filters), true)
  const applications = parseInboxFilters({ source: 'github', application: 'applied', due: 'yes' })
  assert.equal(advancedFiltersActive(applications), true)
  assert.equal(inboxHref(applications), '/app/inbox?application=applied&due=yes&source=github')
  assert.equal(parseInboxFilters({ application: 'unknown' }).application, undefined)
})

test('query combines platform sets, pipeline filters, UTC ranges and deal values before counting and paging', async () => {
  const actor = '11111111-1111-4111-8111-111111111111'
  const owner = '22222222-2222-4222-8222-222222222222'
  const queries: URLSearchParams[] = []
  const db = createClient<Database>('https://inbox.test', 'public-key', {
    accessToken: async () => 'user-session',
    global: { fetch: async (input, init) => {
      queries.push(new URL(input.toString()).searchParams)
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('authorization'), 'Bearer user-session')
      assert.match(headers.get('prefer') ?? '', /count=exact/)
      return new Response('[]', { headers: { 'Content-Range': '*/42', 'Content-Type': 'application/json' } })
    } },
  })
  const now = new Date('2026-11-27T23:55:00Z')
  const filters = parseInboxFilters({ workspace: owner, source: ['reddit', 'hn'], status: ['saved', 'replied'], score: '70', quality: '65', value: '120.50',
    q: '50%_off', assigned: 'me', due: 'next7', days: '1', sort: 'value', page: '2' })
  const response = await queryInbox(db, actor, filters, now)
  assert.equal(response.count, 42)
  const p = queries[0]
  assert.equal(p.get('user_id'), 'eq.' + owner)
  assert.equal(p.get('source'), 'in.(hn,reddit)')
  assert.equal(p.get('status'), 'in.(saved,replied)')
  assert.equal(p.get('title'), 'ilike.%50\\%\\_off%')
  assert.equal(p.get('assignee_id'), 'eq.' + actor)
  assert.equal(p.get('intent_score'), 'gte.70')
  assert.equal(p.get('buyer_quality_score'), 'gte.65')
  assert.equal(p.get('deal_value_cents'), 'gte.12050')
  assert.equal(p.get('posted_at'), 'gte.2026-11-26T23:55:00.000Z')
  assert.deepEqual(p.getAll('follow_up_on'), ['gt.2026-11-27', 'lte.2026-12-04'])
  assert.match(p.get('order')!, /^deal_value_cents\.desc\.nullslast,posted_at\.desc,id\.asc$/)
  assert.equal(p.get('offset'), '20')
  assert.equal(p.get('limit'), '20')
  await queryInbox(db, actor, parseInboxFilters({}), now)
  assert.equal(queries[1].has('source'), false)
  assert.equal(queries[1].has('status'), false)
  assert.equal(queries[1].has('buyer_quality_score'), false)
  await queryInbox(db, actor, parseInboxFilters({ application: 'applied', source: 'remoteok' }), now)
  assert.equal(queries[2].get('applied_at'), 'not.is.null')
  assert.equal(queries[2].get('source'), 'in.(remoteok)')
})

test('inbox remains readable while the applications migration is pending', async () => {
  const queries: URLSearchParams[] = []
  const db = createClient<Database>('https://inbox.test', 'public-key', {
    global: { fetch: async (input) => {
      const params = new URL(input.toString()).searchParams
      queries.push(params)
      if (params.get('select')?.includes('applied_at')) return Response.json(
        { code: '42703', message: 'column leads.applied_at does not exist' }, { status: 400 },
      )
      return Response.json([], { headers: { 'Content-Range': '*/0' } })
    } },
  })
  const response = await queryInbox(db, 'actor', parseInboxFilters({ application: 'applied' }))
  assert.equal(response.error, null)
  assert.equal(queries.length, 2)
  assert.equal(queries[1].get('id'), 'is.null')
})
