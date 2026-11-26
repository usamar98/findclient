import assert from 'node:assert/strict'
import test from 'node:test'
import { readHiringSource } from '../lib/sources/shared-hiring'
import { ProviderBackoff } from '../lib/sources/shared'

const now = Date.parse('2026-11-26T12:00:00Z')
const since = new Date(now - 24 * 3600_000)
const posted = now / 1000 - 60

test('HN collects original top-level employer replies with their comment dates and checks the newest IDs across threads', async t => {
  t.mock.method(Date, 'now', () => now)
  const read: string[] = []
  const thread = (id: number, title: string, kids: number[], by = 'whoishiring') => ({ id, title, kids, by, type: 'story', time: posted - 2_000_000 })
  const comment = (id: number, parent: number, text: string) => ({ id, parent, text, by: 'studio', time: posted, type: 'comment' })
  const rows: Record<string, unknown> = {
    '30': thread(30, 'Ask HN: Who is hiring? (November 2026)', [91, 94, 90, 95, 96, 97, 98, 99, 100, 80]),
    '29': thread(29, 'Ask HN: Who wants to be hired? (November 2026)', [110]),
    '28': thread(28, 'Ask HN: Freelancer? Seeking freelancer? (October 2026)', [92, 93]),
    '27': thread(27, 'Ask HN: Who is hiring? (October 2026)', [111], 'impersonator'),
    '97': comment(97, 30, 'Studio | UX Designer | Contract | Remote. Pay is $80/hour.'),
    '100': null,
    '99': { id: 99, type: 'comment', dead: true },
    '98': comment(98, 30, "We're hiring a freelance developer. The position is filled."),
    '96': { id: 96, deleted: true },
    '95': comment(95, 30, "We're hiring a full-time engineer to manage our permanent products."),
    '94': comment(94, 30, "We're hiring a freelance engineer without compensation."),
    '93': comment(93, 28, 'SEEKING FREELANCER | Build a storefront theme.'),
    '92': comment(92, 28, 'SEEKING WORK | Freelance Shopify developer seeking clients.'),
    '91': comment(91, 444, "We're hiring a freelance artist."),
    '90': { ...comment(90, 30, "We're hiring a freelance designer."), time: now / 1000 + 20 },
    '80': { ...comment(80, 30, "We're hiring a freelance developer."), time: +since / 1000 - 1 },
  }
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    assert.equal(url.hostname, 'hacker-news.firebaseio.com')
    if (url.pathname.endsWith('/user/whoishiring.json')) return Response.json({ id: 'whoishiring', submitted: [30, 29, 28, 27] })
    const key = url.pathname.split('/').pop()!.split('.')[0]
    read.push(key)
    return Response.json(rows[key])
  })
  const result = await readHiringSource('hn', since)
  assert.deepEqual(result.posts.map(p => [p.source_id, p.engagement, p.compensation]), [
    ['97', 'paid_freelance', '$80/hour'], ['93', 'contract_pay_unlisted', undefined],
  ])
  assert.equal(result.posts[0].url, 'https://news.ycombinator.com/item?id=97')
  assert.equal(result.posts[0].posted_at, new Date(posted * 1000).toISOString())
  assert.deepEqual(result.withdrawn, ['99', '98', '96'])
  assert.ok(!read.includes('110') && !read.includes('111'))
  assert.equal(result.partial, false)
})

test('HN preserves collected rows and marks coverage partial at the shared wall-clock deadline', async t => {
  t.mock.method(Date, 'now', () => now)
  let elapsed = 0
  let commentsRead = 0
  t.mock.method(performance, 'now', () => elapsed)
  const ids = Array.from({ length: 24 }, (_, i) => 100 + i)
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.pathname.endsWith('/user/whoishiring.json')) return Response.json({ id: 'whoishiring', submitted: [30] })
    if (url.pathname.endsWith('/30.json')) return Response.json({ id: 30, by: 'whoishiring', type: 'story', title: 'Ask HN: Who is hiring? (November 2026)', kids: ids })
    const id = Number(url.pathname.match(/(\d+)\.json$/)![1])
    commentsRead++
    if (commentsRead === 8) elapsed += 18_001
    return Response.json({ id, type: 'comment', parent: 30, time: posted, by: 'studio', text: "We're hiring a freelance developer." })
  })
  const result = await readHiringSource('hn', since)
  assert.equal(result.partial, true)
  assert.equal(result.posts.length, 8)
  assert.equal(commentsRead, 8)
})

const did = 'did:plc:abcd'
function post(key: string, text = "We're hiring a freelance designer for our web project. The budget is $1200.") {
  return {
    uri: 'at://' + did + '/app.bsky.feed.post/' + key, author: { did, handle: 'studio.bsky.social' },
    record: { text, createdAt: new Date(posted * 1000).toISOString() }, indexedAt: new Date(now).toISOString(),
  }
}

test('Bluesky preserves original record identity, deduplicates across terms and rejects sellers, relays, quotes and stale posts', async t => {
  t.mock.method(Date, 'now', () => now)
  const original = post('original')
  const cases = [
    original, post('unpriced', 'We are hiring a freelance journalist for our next issue.'),
    post('project', "I'm looking to hire an illustrator for a one-off project. Budget: $800."),
    post('seller', "I'm looking for a freelance gig and can design a logo for you."),
    post('employee', "We're hiring a full-time software engineer. Salary is $80/hour."),
    post('freelance-marketplace', "We're hiring a full-time software engineer to improve our marketplace for freelancers."),
    post('relay', 'Alpha Studio is looking for a freelance illustrator for their new brand.'),
    post('collaborator', "I'm looking for a freelance collaborator to find work together."),
    { ...post('feed'), author: { ...original.author, displayName: 'Example | AI & Tech Jobs' } },
    post('stale', "We're hiring a freelance illustrator but this position is filled."),
    { ...post('wrong-owner'), author: { did: 'did:plc:other', handle: 'other.bsky.social' } },
    { ...post('old'), record: { ...original.record, createdAt: new Date(+since - 1).toISOString() } },
    { ...post('future'), record: { ...original.record, createdAt: new Date(now + 1).toISOString() } },
    { ...post('reply'), record: { ...original.record, reply: {} } },
    { ...post('quote'), record: { ...original.record, embed: { $type: 'app.bsky.embed.recordWithMedia' } } },
    { ...post('hidden'), labels: [{ val: '!no-unauthenticated' }] },
    { ...post('hidden-author'), author: { ...original.author, labels: [{ val: '!hide' }] } },
  ]
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    assert.equal(url.hostname, 'api.bsky.app')
    assert.equal(url.searchParams.get('sort'), 'latest')
    return Response.json({ posts: cases })
  })
  const result = await readHiringSource('bluesky', since)
  assert.equal(result.partial, false)
  assert.deepEqual(result.posts.map(p => [p.source_id.split('/').pop(), p.engagement]), [
    ['original', 'paid_freelance'], ['unpriced', 'contract_pay_unlisted'], ['project', 'paid_freelance'],
  ])
  assert.equal(result.posts[0].url, 'https://bsky.app/profile/' + encodeURIComponent(did) + '/post/original')
  assert.equal(result.posts[0].posted_at, original.record.createdAt)
  assert.deepEqual(result.withdrawn?.map(uri => uri.split('/').pop()), ['stale', 'hidden', 'hidden-author'])
})

test('a provider cooldown stops further searches and preserves candidates from successful reads', async t => {
  t.mock.method(Date, 'now', () => now)
  let reads = 0
  t.mock.method(globalThis, 'fetch', async () => ++reads === 1
    ? Response.json({ posts: [post('found')] })
    : new Response(null, { status: 429, headers: { 'retry-after': '120' } }))
  const result = await readHiringSource('bluesky', since)
  assert.equal(reads, 2)
  assert.equal(result.posts.length, 1)
  assert.equal(result.retryAt?.getTime(), now + 120_000)
  assert.equal(result.partial, true)
  await assert.rejects(readHiringSource('bluesky', since), ProviderBackoff)
})
