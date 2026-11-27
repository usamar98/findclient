import assert from 'node:assert/strict'
import { getDailyJobs, loadDailyJobFeed } from '../../lib/daily-jobs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'

const calls: string[] = []
const now = Date.now()
const foundAt = new Date(now - 4_000).toISOString()
const postedAt = new Date(now - 60_000).toISOString()
const jobicyPublished = new Date(now - 4 * 3_600_000).toISOString()
const jobtechPublished = new Date(Math.floor((now - 30_000) / 1000) * 1000)
const stockholm = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const shares = [
  { source: 'hn', url: 'https://news.ycombinator.com/item?id=1234', posted_at: postedAt, first_found_at: foundAt,
    listing: { title: 'Hire a Shopify developer', body: 'Our studio is hiring a Shopify developer for a contract.', author: 'studio', engagement: 'contract_pay_unlisted' } },
  { source: 'bluesky', url: 'https://bsky.app/profile/did:plc:studio/post/abc', posted_at: postedAt, first_found_at: foundAt,
    listing: { title: 'Need a Shopify designer', body: 'We have a $500 budget for a Shopify designer.', author: 'buyer.bsky.social', engagement: 'paid_freelance', compensation: '$500' } },
]
let communityStatus = 'checked'
const jobs = [['Webflow designer', 1, 'Pay is $80 per hour.'], ['Python engineer', 2, 'Review an existing codebase.'], ['Previous day', 25, 'Pay is $80 per hour.']] as const
const rows = jobs.map(([title, hours, body]) => {
  const date = new Date(Date.now() - hours * 3_600_000).toUTCString()
  return '<item><title>Studio: ' + title + '</title><type>Contract</type><description>' + body + '</description>' +
    '<pubDate>' + date + '</pubDate><link>https://weworkremotely.com/remote-jobs/' + title.replace(' ', '-') + '</link></item>'
})

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init)
  const url = new URL(request.url)
  calls.push(url.hostname)
  if (url.hostname === 'database.example.test') {
    switch (url.pathname) {
      case '/rest/v1/source_backoffs':
        return Response.json([{ source: 'github', retry_at: new Date(Date.now() + 60_000).toISOString() }])
      case '/rest/v1/rpc/record_job_discoveries': {
        const { p_jobs } = await request.json() as { p_jobs: { source: string; url: string }[] }
        return Response.json(p_jobs.map(({ source, url }) => ({ source, url, first_found_at: foundAt })))
      }
      case '/rest/v1/rpc/claim_shared_hiring_sources': return Response.json([])
      case '/rest/v1/shared_hiring_sources': return Response.json(shares.map(job => ({
        source: job.source, status: communityStatus, partial: false, last_checked_at: foundAt, last_success_at: foundAt,
      })))
      case '/rest/v1/shared_hiring_jobs': return Response.json(shares.filter(job => url.searchParams.get('source') === 'eq.' + job.source))
      default: assert.fail('Unexpected database request ' + url.pathname)
    }
  }
  if (url.hostname === 'weworkremotely.com') return new Response('<rss><channel><title>We Work Remotely</title>' + rows.join('') + '</channel></rss>')
  if (url.hostname === 'jobicy.com') return Response.json({ success: true, nextCursor: null, jobs: [
    { companyName: 'Studio', jobTitle: 'Backend software engineer', jobType: ['Contract'], jobDescription: 'Build a customer portal.',
      pubDate: jobicyPublished, url: 'https://jobicy.com/jobs/backend-software-engineer', salaryMin: 80, salaryMax: 100,
      salaryPeriod: 'hourly', salaryCurrency: 'USD' },
  ] })
  if (url.hostname === 'jobsearch.api.jobtechdev.se') return Response.json({ total: {value: 1}, hits: [
    { id: '1234', employer: {name: 'Studio AB'}, headline: 'Freelance software engineer', removed: false, description: {text: 'Build a client portal.'},
      publication_date: stockholm.format(jobtechPublished).replace(' ', 'T'), timestamp: jobtechPublished.getTime() },
  ] })
  return new Response('', { status: 403 })
}

async function verify() {
  const search = await loadDailyJobFeed()
  const checked = [...calls].sort()
  assert.deepEqual(checked.filter(host => host !== 'database.example.test'), [
    'jobicy.com', 'jobsearch.api.jobtechdev.se', 'mastodon.social', 'remoteok.com', 'weworkremotely.com',
  ])
  const browse = search()
  assert.equal(browse.sources.length, 8)
  assert.deepEqual(search('software engineer').posts.filter(job => job.source === 'jobicy' || job.source === 'jobtech')
    .map(job => [job.source, job.url, job.engagement, job.posted_at]), [
    ['jobtech', 'https://arbetsformedlingen.se/platsbanken/annonser/1234', 'contract_pay_unlisted', jobtechPublished.toISOString()],
    ['jobicy', 'https://jobicy.com/jobs/backend-software-engineer', 'paid_freelance', jobicyPublished],
  ])
  assert.deepEqual(browse.posts.filter(job => job.source === 'weworkremotely').map(job => job.title), ['Webflow designer', 'Python engineer'])
  assert.deepEqual(browse.posts.filter(job => job.source === 'weworkremotely').map(job => job.engagement), ['paid_freelance', 'contract_pay_unlisted'])
  assert.ok(browse.posts.every(job => job.first_found_at === foundAt))
  assert.deepEqual(search('Shopify').posts.map(job => job.source).sort(), ['bluesky', 'hn'])
  assert.ok(search('Shopify').posts.every(job => Date.parse(job.posted_at) === Date.parse(postedAt)))
  assert.equal(browse.sources.find(row => row.source === 'github')?.status, 'cooldown')
  assert.deepEqual(search('Webflow').posts.map(job => job.title), ['Webflow designer'])
  assert.deepEqual(search('Python').posts.map(job => job.title), ['Python engineer'])
  assert.deepEqual([...calls].sort(), checked)

  calls.length = 0
  const delayed = await getDailyJobs('software engineer', 'jobicy', '15')
  assert.deepEqual(delayed.posts, [])
  assert.equal(delayed.sources[0].status, 'delayed')
  assert.ok(!calls.includes('jobicy.com'))
  assert.deepEqual((await getDailyJobs('software engineer', 'jobtech', '1')).posts.map(job => job.url),
    ['https://arbetsformedlingen.se/platsbanken/annonser/1234'])

  calls.length = 0
  const single = await getDailyJobs('', 'weworkremotely')
  assert.deepEqual(single.sources.map(row => row.source), ['weworkremotely'])
  assert.deepEqual(calls.filter(host => host !== 'database.example.test'), ['weworkremotely.com'])

  calls.length = 0
  communityStatus = 'cooldown'
  const cached = await getDailyJobs('Shopify', 'hn')
  assert.deepEqual(cached.sources.map(row => row.source), ['hn'])
  assert.equal(cached.sources[0].partial, true)
  assert.deepEqual(cached.posts.map(job => job.url), [shares[0].url])
  assert.equal(cached.posts[0].first_found_at, foundAt)
  assert.ok(calls.every(host => host === 'database.example.test'))
}

verify().catch(error => { console.error(error); process.exitCode = 1 })
