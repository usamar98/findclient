import assert from 'node:assert/strict'
import { getDailyJobs, loadDailyJobFeed } from '../../lib/daily-jobs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'

const calls: string[] = []
const jobs = [['Webflow designer', 1, 'Pay is $80 per hour.'], ['Python engineer', 2, 'Review an existing codebase.'], ['Previous day', 25, 'Pay is $80 per hour.']] as const
const rows = jobs.map(([title, hours, body]) => {
  const date = new Date(Date.now() - hours * 3_600_000).toUTCString()
  return '<item><title>Studio: ' + title + '</title><type>Contract</type><description>' + body + '</description>' +
    '<pubDate>' + date + '</pubDate><link>https://weworkremotely.com/remote-jobs/' + title.replace(' ', '-') + '</link></item>'
})

globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : input)
  calls.push(url.hostname)
  if (url.hostname === 'database.example.test') {
    assert.equal(url.pathname, '/rest/v1/source_backoffs')
    return Response.json([{ source: 'github', retry_at: new Date(Date.now() + 60_000).toISOString() }])
  }
  if (url.hostname === 'weworkremotely.com') return new Response('<rss><channel><title>We Work Remotely</title>' + rows.join('') + '</channel></rss>')
  return new Response('', { status: 403 })
}

async function verify() {
  const search = await loadDailyJobFeed()
  const checked = [...calls].sort()
  assert.deepEqual(checked, ['database.example.test', 'mastodon.social', 'remoteok.com', 'weworkremotely.com'])
  const browse = search()
  assert.deepEqual(browse.posts.map(job => job.title), ['Webflow designer', 'Python engineer'])
  assert.deepEqual(browse.posts.map(job => job.engagement), ['paid_freelance', 'contract_pay_unlisted'])
  assert.equal(browse.sources.find(row => row.source === 'github')?.status, 'cooldown')
  assert.deepEqual(search('Webflow').posts.map(job => job.title), ['Webflow designer'])
  assert.deepEqual(search('Python').posts.map(job => job.title), ['Python engineer'])
  assert.deepEqual([...calls].sort(), checked)

  calls.length = 0
  const single = await getDailyJobs('', 'weworkremotely')
  assert.deepEqual(single.sources.map(row => row.source), ['weworkremotely'])
  assert.deepEqual(calls, ['database.example.test', 'weworkremotely.com'])
}

verify().catch(error => { console.error(error); process.exitCode = 1 })
