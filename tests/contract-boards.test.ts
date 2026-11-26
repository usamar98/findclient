import assert from 'node:assert/strict'
import test from 'node:test'
import { searchContractBoard } from '../lib/sources/contract-boards'
import { ProviderBackoff } from '../lib/sources/shared'

const now = Date.parse('2026-11-26T03:25:00Z')
const since = new Date(now - 15 * 60_000)
const fresh = 'Thu, 26 Nov 2026 03:20:10 +0000'
const wwr = 'https://weworkremotely.com/remote-jobs/'
const rok = 'https://remoteok.com/remote-jobs/'
function rssRow(slug: string, settings: { type?: string; text?: string; date?: string; expires?: string; link?: string } = {}) {
  const {type = 'Contract', text = 'Our freelance rate is $5 to $7 USD/Per Hour.', date = fresh, expires = 'Thu, 17 Dec 2026 00:00:00 +0000', link = wwr + slug} = settings
  return `<item><title>Acme: ${slug}</title><type>${type}</type><description><![CDATA[<p>${text}</p>]]></description><pubDate>${date}</pubDate><expires_at>${expires}</expires_at><skills>Webflow, Design</skills><link>${link}</link></item>`
}
function rss(...entries: string[]) {
  return `<rss><channel><title>We Work Remotely</title>${entries.join('')}</channel></rss>`
}
function remoteJob(id: string, title: string, description = 'Compensation is $60 per hour.') {
  return { id, url: rok + 'publisher-slug-' + id, position: title, description, company: 'Acme', tags: [], date: new Date(now - 30_000).toISOString(), epoch: (now - 30_000) / 1000, salary_min: 0, salary_max: 0 }
}

test('We Work Remotely uses publisher time, contract type, pay evidence, expiry, attribution link and feed TTL', async t => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://weworkremotely.com/remote-jobs.rss')
    assert.equal(init.next?.revalidate, 3600)
    return new Response(rss(rssRow('transcriptionist'), rssRow('transcriptionist'), rssRow('permanent', {type:'Full-Time'}),
      rssRow('no-pay', {text:'This is an unpaid role. Include your hourly rate.'}), rssRow('raised-funds', {text:'The business raised $2M last quarter.'}),
      rssRow('expired', {expires:fresh}), rssRow('early', {date:'Thu, 26 Nov 2026 03:09:59 +0000'}),
      rssRow('future', {date:'Thu, 26 Nov 2026 03:26:00 +0000'}), rssRow('external', {link:'https://example.test/remote-jobs/hire'})))
  })
  const result = await searchContractBoard('weworkremotely', since)
  assert.equal(result.partial, false)
  assert.equal(result.candidates.length, 4)
  assert.deepEqual(result.posts.map(post => [post.source, post.title, post.author, post.url, post.compensation, post.engagement, post.posted_at]), [
    ['weworkremotely', 'transcriptionist', 'Acme', wwr + 'transcriptionist', '$5 to $7 USD/Per Hour', 'paid_freelance', '2026-11-26T03:20:10.000Z'],
  ])
})

test('Remote OK distinguishes contract hiring from contract-related permanent work and ignores feed generation time', async t => {
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, 'https://remoteok.com/api')
    return Response.json([{ last_updated: now / 1000, legal:'Link back to Remote OK' },
      remoteJob('1', 'Web Designer (Contract)'), remoteJob('2', 'Smart-contract Engineer'),
      remoteJob('3', 'Procurement Contract Manager'), remoteJob('4', 'Software Engineer', 'We manage a team of contractors. Salary: $80,000.'),
      remoteJob('5', 'Freelance designer', 'Equity only, salary: $80,000 after funding.'), remoteJob('6', 'Freelance developer', 'We have raised $100 million.'),
      { ...remoteJob('7', 'Contractor'), closed: true }, { ...remoteJob('8', 'Contractor'), url:rok + 'other-9' },
      { ...remoteJob('9', 'Contractor'), epoch: now / 1000 }, { ...remoteJob('10', 'Developer', 'Employment type: freelance'), salary_min: 1000 },
      { ...remoteJob('11', 'Freelance writer'), date:'2026-11-25T20:00:00Z', epoch: Date.parse('2026-11-25T20:00:00Z') / 1000 },
    ])
  })
  const result = await searchContractBoard('remoteok', since)
  assert.deepEqual(result.posts.map(post => [post.title, post.compensation, post.url]), [
    ['Web Designer (Contract)', '$60 per hour', rok + 'publisher-slug-1'], ['Developer', undefined, rok + 'publisher-slug-10'],
  ])
})

test('boards distinguish partial samples, provider errors, and precise empty windows', async t => {
  t.mock.method(Date, 'now', () => now)
  let body = rss(...Array.from({length:100}, (_, i) => rssRow('job-' + i)))
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(body))
  assert.equal((await searchContractBoard('weworkremotely', since)).partial, true)
  body = rss(rssRow('date-only', {date:'2026-11-26'}))
  const dateOnly = await searchContractBoard('weworkremotely', since)
  assert.deepEqual(dateOnly, {posts:[], candidates:[], partial:true})
  body = rss()
  assert.deepEqual(await searchContractBoard('weworkremotely', since), {posts:[], candidates:[], partial:false})
  body = '<!DOCTYPE rss SYSTEM "external"><rss />'
  await assert.rejects(searchContractBoard('weworkremotely', since))
  mock.mock.mockImplementation(async () => new Response(null, {status:429, headers:{'Retry-After':'90'}}))
  await assert.rejects(searchContractBoard('remoteok', since), ProviderBackoff)
})
