import test from 'node:test'
import assert from 'node:assert/strict'
import { searchMastodonJobs } from '../lib/sources/mastodon-jobs'
import { ProviderBackoff } from '../lib/sources/shared'

const now = Date.parse('2026-11-26T03:45:00Z')
const since = new Date(now - 15 * 60_000)
const site = 'https://mastodon.social'
const account = {acct:'studio',url:site + '/@studio',uri:site+'/ap/users/77',bot:false,indexable:true}
function post(id: string, body = 'We’re hiring a freelance illustrator for our game at 50–70 USD/hr. Send us your portfolio.') {
  return { id, uri:site+'/ap/users/77/statuses/'+id, url:site+'/@studio/'+id, account, visibility:'public', sensitive:false, reblog:null,
    in_reply_to_id:null, in_reply_to_account_id:null, created_at:new Date(now-30000).toISOString(), content:'<p>'+body+'</p>', tags:[{name:'FediHire'}] }
}

test('Mastodon links only to verified public status URLs and uses original time, author text, pay, and opt-in', async t => {
  t.mock.method(Date,'now',()=>now)
  t.mock.method(globalThis,'fetch',async (url:URL, init:RequestInit) => {
    assert.equal(url.origin,site)
    assert.equal(url.pathname,'/api/v1/timelines/tag/hiring')
    assert.deepEqual(url.searchParams.getAll('any[]'),['fedihire','freelance','gamedevjobs'])
    assert.equal(url.searchParams.get('limit'),'40')
    assert.equal(init.next?.revalidate,30)
    const first = post('1001')
    const remote = {...post('1002'),uri:'https://elsewhere.social/users/studio/statuses/88',url:'https://elsewhere.social/@studio/88',account:{...account,url:'https://elsewhere.social/@studio',uri:'https://elsewhere.social/users/studio',acct:'studio@elsewhere.social'}}
    return Response.json([first,first,remote,{...post('1003'), visibility:'unlisted'}, {...post('1004'),account:{...account,indexable:false}},
      {...post('1005'),sensitive:true},{...post('1006'),quote:{status:first}},{...post('1007'),reblog:first},{...post('1008'),in_reply_to_id:'3'},
      {...post('1009'),created_at:'2026-11-26T03:29:59Z',edited_at:new Date(now).toISOString()},
      {...post('1010'), account:{...account,bot:true}},{...post('1011'), account:{...account,noindex:true}},
      {...post('1012'),uri:'https://other.example/users/studio/statuses/1012'}, {...post('1013'),url:site+'/@fake/1013'},
      {...post('1014'),tags:[{name:'somethingother'}]}, {...post('1015'),created_at:new Date(now+5000).toISOString()},
      post('1016','Here is an interesting role. <blockquote>We are hiring a freelance illustrator for $80/hr.</blockquote>')])
  })
  const result = await searchMastodonJobs(since)
  assert.deepEqual(result.candidates.map(p=>p.url),[site+'/@studio/1001','https://elsewhere.social/@studio/88'])
  assert.equal(result.posts.length,2)
  assert.deepEqual([result.posts[0].posted_at,result.posts[0].engagement,result.posts[0].compensation,result.posts[0].author],['2026-11-26T03:44:30.000Z','paid_freelance','50–70 USD/hr',''])
})

test('public seller offers, re-shared vacancies, unpriced asks, link labels and jobs seeking funds only count as examined', async t => {
  t.mock.method(Date,'now',()=>now)
  const body = [
    'We are hiring a freelance web designer for a paid contract. Contact people@example.com or <a href="https://example.com">visit our careers site</a>.',
    'Hire me: freelance artist working for 40 USD/hr. I am looking for clients.',
    'Studio across the street is hiring a freelance artist for $40/hour. Apply on their site.',
    'We are hiring a freelance developer. Please apply if interested.',
    'We are hiring a full-time designer. Salary: $140,000.',
    'We are hiring a freelance engineer. We could pay $40/hour if we get funding.',
    'Reposting: we are hiring a freelance engineer at $50/hour.',
    'We are hiring a freelance designer. <a href="https://example.com">Pay rate: $60/hour</a>',
    'We are hiring a freelance artist at $60/hr. Position filled.',
  ]
  t.mock.method(globalThis,'fetch',async ()=>Response.json(body.map((text,i)=>post(String(i+20),text))))
  const r=await searchMastodonJobs(since)
  assert.equal(r.candidates.length,body.length)
  assert.deepEqual(r.posts.map(p=>p.url),[site+'/@studio/20'])
  assert.doesNotMatch(r.posts[0].body,/@|https|careers site/)
})

test('bounded public timeline reports truncated sampling and respects rate-limit responses',async t=>{
  t.mock.method(Date,'now',()=>now)
  const mock=t.mock.method(globalThis,'fetch',async()=>Response.json(Array.from({length:40},(_,i)=>post(String(i+100)))))
  assert.equal((await searchMastodonJobs(since)).partial,true)
  mock.mock.mockImplementation(async()=>Response.json([post('200')],{headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':new Date(now+30000).toISOString()}}))
  const limited = await searchMastodonJobs(since)
  assert.equal(limited.posts.length,1)
  assert.equal(limited.retryAt?.getTime(),now+30000)
  mock.mock.mockImplementation(async()=>new Response(null,{status:429,headers:{'Retry-After':'90'}}))
  await assert.rejects(searchMastodonJobs(since),ProviderBackoff)
})
