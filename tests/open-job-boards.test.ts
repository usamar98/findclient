import assert from 'node:assert/strict'
import test from 'node:test'
import { searchOpenJobBoard } from '../lib/sources/open-job-boards'
import { matchJobListing, researchMatchPlan } from '../lib/research-matching'

const now = Date.parse('2026-11-28T12:30:00Z')
const day = new Date(now - 86_400_000)
const sourceUrl = 'https://jobicy.com/jobs/'
function contract(slug: string, overrides: Record<string, unknown> = {}) {
  return { url: sourceUrl + slug, jobTitle: 'Software Engineer', companyName: 'Studio',
    jobDescription: '<p>Build our Shopify integration.</p>', jobType: ['Contract'], jobIndustry: ['Engineering'],
    pubDate: '2026-11-28T08:29:59+00:00', salaryMin: 60, salaryMax: 80, salaryPeriod: 'hourly', salaryCurrency: 'USD', ...overrides }
}
const jobicy = (jobs: unknown[], nextCursor: string | null = null) => Response.json({ success: true, jobs, nextCursor })

test('Jobicy checks its publisher feed with hourly caching and keeps original times, pay and attribution', async t => {
  t.mock.method(Date, 'now', () => now)
  const calls: URL[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    calls.push(new URL(url))
    assert.equal(options.next?.revalidate, 3600)
    return url.searchParams.has('cursor') ? jobicy([
      contract('also', {salaryMin: null, salaryMax: null}), contract('capped', {salaryMin: null}),
      contract('old', { pubDate: '2026-11-26T13:00:00Z' }),
    ]) : jobicy([
      contract('role'), contract('role'), contract('role-2', {jobType:['Full-Time']}),
      contract('foreign', {url:'https://example.org/jobs/foreign'}),
      contract('date-only', {pubDate:'2026-11-28'}), contract('unpaid', {jobDescription:'Unpaid freelance role.'}),
      contract('closed', {jobDescription:'Position filled.'}),
    ], 'next/token')
  })
  const found = await searchOpenJobBoard('jobicy', day)
  assert.deepEqual(calls.map(url => url.searchParams.get('cursor')), [null, 'next/token'])
  assert.deepEqual(found.posts.map(p => [p.url, p.posted_at, p.compensation]), [
    [sourceUrl + 'role', '2026-11-28T08:29:59.000Z', 'USD 60–80 hourly'],
    [sourceUrl + 'capped', '2026-11-28T08:29:59.000Z', 'Up to USD 80 hourly'],
  ])
  assert.deepEqual(found.unpricedContracts.map(p => p.url), [sourceUrl + 'also'])
  assert.equal(found.partial, true) // Date-only row could not be verified.
  assert.equal((await searchOpenJobBoard('jobicy', new Date(now - 60_000))).posts.length, 0)
  assert.equal(calls.at(-1)?.href, calls[0].href)
})

test('a pagination cooldown retains reviewed Jobicy results and requests a retry after provider backoff', async t => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async (url: URL) => url.searchParams.has('cursor')
    ? new Response('', {status: 429, headers: {'retry-after': '240'}}) : jobicy([contract('role')], 'more'))
  const result = await searchOpenJobBoard('jobicy', day)
  assert.equal(result.partial, true)
  assert.equal(result.posts.length, 1)
  assert.equal(result.retryAt?.getTime(), now + 240_000)
})

test('Jobicy can continue beyond 200 candidates and stops at the end of the publication window', async t => {
  t.mock.method(Date, 'now', () => now)
  let pages = 0
  t.mock.method(globalThis, 'fetch', async () => {
    pages++
    const rows = pages < 5 ? Array.from({length: 50}, (_, i) => contract('fulltime-' + pages + '-' + i, {jobType: ['Full-Time']})) :
      [contract('target'), contract('earlier', {pubDate: '2026-11-27T12:00:00Z'})]
    return jobicy(rows, 'next-' + pages)
  })
  const result = await searchOpenJobBoard('jobicy', day)
  assert.deepEqual(result.posts.map(p => p.url), [sourceUrl + 'target'])
  assert.equal(result.partial, false)
  assert.equal(pages, 5)
})

function swedish(id: string, overrides: Record<string, unknown> = {}) {
  return { id, headline: 'Software Engineer', description: {text:'Önskar du arbeta som underkonsult via eget bolag?'},
    employer: {name:'Exempel'}, occupation:{label:'Software Engineer'}, publication_date:'2026-11-28T13:29:45',
    last_publication_date:'2026-12-01T23:59:59', removed:false, ...overrides }
}

test('JobTech returns only explicit, open contractor offers using original Swedish publication time', async t => {
  t.mock.method(Date, 'now', () => now)
  const hits = [swedish('11', {description:{text:'Arbeta som underkonsult. 750 SEK/timme.'}, timestamp: now}),
    swedish('12', {headline:'Freelance developer'}), swedish('13', {removed:true}),
    swedish('14', {description:{text:'We manage contractor claims on the construction site.'}}),
    swedish('15', {description:{text:'Du kan frilansa vid sidan av ditt fasta jobb.'}}),
    swedish('16', {last_publication_date:'2026-11-25T23:59:59'}), swedish('17',{publication_date:'2026-11-28'}),
    swedish('bad-id'), swedish('18',{publication_date:'2026-11-28T13:28:50'}),
    swedish('19', {headline:'Freelance developer', description:{text:'Arbetet ersätts med 0 kr/timme.'}}),
  ]
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.equal(url.hostname, 'jobsearch.api.jobtechdev.se')
    assert.equal(url.searchParams.get('sort'), 'pubdate-desc')
    assert.equal(options.next?.revalidate, 60)
    return Response.json({hits, total:{value:hits.length}})
  })
  const result = await searchOpenJobBoard('jobtech', new Date(now - 60_000))
  assert.deepEqual(result.posts.map(p => [p.url, p.posted_at, p.compensation]), [
    ['https://arbetsformedlingen.se/platsbanken/annonser/11','2026-11-28T12:29:45.000Z','750 SEK/timme'],
  ])
  assert.deepEqual(result.unpricedContracts.map(p => p.title), ['Freelance developer'])
  assert.equal(result.partial, true)
})

test('JobTech disambiguates the autumn DST hour only when a source timestamp corroborates it', async t => {
  const end = Date.parse('2026-10-25T02:40:00Z')
  t.mock.method(Date, 'now', () => end)
  const pub = '2026-10-25T02:30:00'
  const hits = [swedish('1',{publication_date:pub,timestamp:Date.parse('2026-10-25T01:30:00.137Z')}),
    swedish('2',{publication_date:pub,timestamp:end})]
  t.mock.method(globalThis, 'fetch', async () => Response.json({hits,total:{value:2}}))
  const result = await searchOpenJobBoard('jobtech', new Date(end - 86_400_000))
  assert.deepEqual(result.unpricedContracts.map(p => p.posted_at), ['2026-10-25T01:30:00.000Z'])
  assert.equal(result.partial, true)
})

test('typed JobTech search consults the skill index and recognizes explicit invoice offers without admitting salaried or expired ads', async t => {
  t.mock.method(Date, 'now', () => now)
  const calls: string[] = []
  const listing = (id: string, text: string, overrides = {}) => swedish(id, {
    headline: 'Shopify developer', description: {text}, ...overrides,
  })
  // Public Platsbanken ads 31788914 and 31787411 use these two forms of
  // invoicing language. Role and timestamps here are deterministic fixtures.
  const independent = listing('30', 'Du kan välja om du vill fakturera genom ditt eget bolag eller bli direkt anställd hos oss.')
  const targetRows = [
    independent,
    listing('31', 'Contractors must operate and invoice through their own Swedish limited company.'),
    listing('32', 'Du kan inte fakturera genom ditt eget bolag.'),
    listing('33', 'Manage invoices for contractors. This is a permanent salaried role.'),
    listing('34', 'Arbeta som underkonsult.', {publication_date: '2026-11-27T10:00:00'}),
  ]
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    const q = url.searchParams.get('q')!
    calls.push(q)
    assert.equal(new Headers(options.headers).get('x-feature-freetext-bool-method'), 'or')
    const hits = q.startsWith('shopify') ? targetRows : [independent]
    return Response.json({hits, total: {value: hits.length}})
  })
  const result = await searchOpenJobBoard('jobtech', day, 'Shopify Developer')
  assert.equal(calls.length, 2)
  assert.ok(calls.includes('shopify shopifyutvecklare'))
  assert.equal(result.candidates.length, 4)
  assert.deepEqual(result.unpricedContracts.map(row => row.url.split('/').pop()), ['30', '31'])
  assert.equal(result.partial, false)
})

test('JobTech keeps the shared feed if the requested skill search is throttled', async t => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async (url: URL) => url.searchParams.get('q')?.includes('frilansare')
    ? Response.json({ total: {value: 1}, hits: [swedish('11')] })
    : new Response('', {status: 429, headers: {'retry-after': '90'}}))
  const result = await searchOpenJobBoard('jobtech', day, 'software engineer')
  assert.equal(result.unpricedContracts.length, 1)
  assert.equal(result.partial, true)
  assert.equal(result.retryAt?.getTime(), now + 90_000)
})

test('English queries match Swedish contractor occupations while preserving the original headline', async t => {
  t.mock.method(Date, 'now', () => now)
  // An actual Platsbanken headline, occupation label and engagement phrase. Dates,
  // employers and identifiers are fixture values so the test stays repeatable.
  const genuine = swedish('21', { headline: 'Senior systemutvecklare - Distans', occupation: {label: 'Systemutvecklare/Programmerare'},
    description: {text: 'Vi samarbetar även med underkonsulter och frilansare med eget bolag.'} })
  const role = (id: string, headline: string, occupation: string, text = 'Uppdrag för eget bolag.') =>
    swedish(id, { headline, occupation: {label: occupation}, description: {text} })
  const hits = [genuine, role('22', 'Frilansande mjukvaruutvecklare', ''), role('23', 'Frilansande webbutvecklare', ''),
    role('24', 'Frilansande grafisk formgivare', ''), role('25', 'Frilansande Shopify-utvecklare', ''),
    role('26', 'Frilansande lärare för webbutvecklare', 'Yrkeslärare', 'Våra deltagare vill bli webbutvecklare.')]
  t.mock.method(globalThis, 'fetch', async () => Response.json({hits, total:{value: hits.length}}))
  const jobs = (await searchOpenJobBoard('jobtech', day)).unpricedContracts
  assert.equal(jobs.length, hits.length)
  const matches = (query: string) => jobs.filter(job => matchJobListing(researchMatchPlan(query), job, false)).map(job => job.title)
  assert.deepEqual(matches('software engineer'), [genuine.headline, hits[1].headline, hits[2].headline, hits[4].headline])
  assert.deepEqual(matches('Shopify developer'), [hits[4].headline])
  assert.deepEqual(matches('web developer'), [hits[2].headline, hits[4].headline])
  assert.deepEqual(matches('graphic designer'), [hits[3].headline])
})
