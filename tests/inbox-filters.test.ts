import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { PGlite } from '@electric-sql/pglite'
import type { Database } from '../lib/db/schema'
import { advancedFiltersActive, inboxHref, inboxResearchHref, isInboxNavigation, parseInboxFilters } from '../lib/inbox-filters'
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

test('recent inbox accepts only live windows and links to an intentional search with the same sources', () => {
  for (const days of ['1', '3', '7', '30']) {
    const legacy = parseInboxFilters({ days, q: 'Shopify developer' })
    assert.equal(legacy.window, '1440')
    assert.equal(legacy.view, undefined)
    assert.doesNotMatch(inboxHref(legacy), /days=/)
  }
  assert.equal(parseInboxFilters({ window: '10080' }).window, '1440')
  const filters = parseInboxFilters({ q: 'software engineer', window: '5', source: ['hn', 'bluesky'] })
  const href = new URL(inboxResearchHref(filters, true), 'https://example.org')
  assert.equal(href.pathname, '/app/research')
  assert.equal(href.searchParams.get('q'), 'software engineer')
  assert.equal(href.searchParams.get('window'), '5')
  assert.equal(href.searchParams.get('run'), '1')
  assert.deepEqual(href.searchParams.getAll('source'), ['hn', 'bluesky'])
  assert.doesNotMatch(inboxResearchHref(filters), /run=/)
  assert.doesNotMatch(inboxResearchHref(parseInboxFilters({}), true), /run=/)
  assert.match(inboxResearchHref(parseInboxFilters({ source: 'remoteok' }), true), /run=1/)
  const navigation = (from: string, site?: string) => isInboxNavigation(new Headers({
    host: 'example.org', referer: from, ...(site && { 'sec-fetch-site': site }),
  }))
  assert.ok(navigation('https://example.org/app/inbox?q=design', 'same-origin'))
  assert.equal(navigation('https://other.example/app/inbox'), false)
  assert.equal(navigation('https://example.org/app/inbox', 'cross-site'), false)
  assert.equal(navigation('https://example.org/app/jobs'), false)
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
    q: 'Shopify developer', assigned: 'me', due: 'next7', window: '1', sort: 'value', page: '2' })
  const response = await queryInbox(db, actor, filters, now)
  assert.equal(response.count, 42)
  const p = queries[0]
  assert.equal(p.get('user_id'), 'eq.' + owner)
  assert.equal(p.get('source'), 'in.(hn,reddit)')
  assert.equal(p.get('status'), 'in.(saved,replied)')
  assert.ok(p.getAll('title').length)
  assert.ok(p.getAll('title').every(filter => filter.startsWith('imatch.')))
  assert.equal(p.get('assignee_id'), 'eq.' + actor)
  assert.equal(p.get('intent_score'), 'gte.70')
  assert.equal(p.get('buyer_quality_score'), 'gte.65')
  assert.equal(p.get('deal_value_cents'), 'gte.12050')
  assert.deepEqual(p.getAll('posted_at'), ['gte.2026-11-27T23:54:00.000Z', 'lte.2026-11-27T23:55:00.000Z'])
  assert.deepEqual(p.getAll('follow_up_on'), ['gt.2026-11-27', 'lte.2026-12-04'])
  assert.match(p.get('order')!, /^deal_value_cents\.desc\.nullslast,posted_at\.desc,id\.asc$/)
  assert.equal(p.get('offset'), '20')
  assert.equal(p.get('limit'), '20')
  await queryInbox(db, actor, parseInboxFilters({}), now)
  assert.equal(queries[1].has('source'), false)
  assert.equal(queries[1].has('status'), false)
  assert.equal(queries[1].has('buyer_quality_score'), false)
  assert.equal(queries[1].get('posted_at'), 'gte.2026-11-26T23:55:00.000Z')
  await queryInbox(db, actor, parseInboxFilters({ view: 'history', application: 'applied', source: 'remoteok' }), now)
  assert.equal(queries[2].has('posted_at'), false)
  assert.equal(queries[2].get('applied_at'), 'not.is.null')
  assert.equal(queries[2].get('source'), 'in.(remoteok)')
})

test('original title filters execute against PostgreSQL with synonym and identifier boundaries', async () => {
  let query = new URLSearchParams()
  const db = createClient<Database>('https://inbox.test', 'public-key', {
    global: { fetch: async input => {
      query = new URL(input.toString()).searchParams
      return Response.json([], { headers: { 'Content-Range': '*/0' } })
    } },
  })
  const pg = new PGlite()
  async function titles(q: string, candidates: string[]) {
    await queryInbox(db, 'user', parseInboxFilters({ q }))
    const patterns = query.getAll('title').map(filter => filter.slice('imatch.'.length))
    const { rows } = await pg.query<{title: string}>(`
      select title from unnest($1::text[]) as row(title)
      where not exists (select from unnest($2::text[]) as pattern(regex) where title !~* regex)
    `, [candidates, patterns])
    return rows.map(row => row.title)
  }
  try {
    assert.deepEqual(await titles('Shopify developer', [
      'Shopify app developer', 'Developer needed for Shopify', 'WordPress developer', 'Jewelry for Shopify stores',
    ]), ['Shopify app developer', 'Developer needed for Shopify'])
    assert.deepEqual(await titles('software engineer', [
      'Senior Software Developer', 'Office Manager at a software vendor', 'Mechanical engineer',
    ]), ['Senior Software Developer'])
    assert.deepEqual(await titles('C++', ['C++ contractor', 'C# contractor', 'Embedded C contractor']), ['C++ contractor'])
    assert.deepEqual(await titles('"Shopify developer"', ['Shopify developer.', 'Shopify app developer']), ['Shopify developer.'])
  } finally { await pg.close() }
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
