import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('the shared feed keeps first observations, fences overlapping collectors, and preserves results during cooldown', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.source_backoffs (source text primary key, retry_at timestamptz);
    grant all on public.source_backoffs to service_role;
    create function public.defer_source(p_source text,p_until timestamptz) returns void language sql as $$
      insert into public.source_backoffs values (p_source,p_until) on conflict (source)
      do update set retry_at=greatest(source_backoffs.retry_at,excluded.retry_at) $$;`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261126183650_shared_hiring_feed.sql', import.meta.url), 'utf8'))
  const query = async <T>(sql: string, args: unknown[] = []) => (await db.query<T>(sql, args)).rows
  const claim = () => query<{source: string; lease_id: string}>('select * from claim_shared_hiring_sources($1)', [['hn', 'bluesky']])
  const stored = () => query<{found: string; title: string}>(`select first_found_at::text as found, listing->>'title' as title from shared_hiring_jobs where source='hn'`)
  const posted = new Date(Date.now() - 720_000).toISOString()
  const job = { source: 'hn', source_key: '101', url: 'https://news.ycombinator.com/item?id=101', posted_at: posted,
    listing: { title: 'Contract designer', body: 'We are hiring a freelance designer.', author: 'studio', engagement: 'contract_pay_unlisted' } }
  const finish = async (lease: string, jobs: unknown[], status = 'checked', retry: string | null = null) =>
    (await query<{ok: boolean}>('select complete_shared_hiring_source($1,$2,$3,$4,$5,$6) as ok',
      ['hn', lease, status, status !== 'checked', retry, JSON.stringify(jobs)]))[0].ok
  for (const role of ['anon','authenticated']) {
    await db.exec('set role ' + role)
    await assert.rejects(claim(), /permission denied/)
    await assert.rejects(stored(), /permission denied/)
    await assert.rejects(query("select * from record_job_discoveries('[]')"), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role service_role')
  const leases = await claim()
  assert.equal(leases.length, 2)
  assert.deepEqual(await claim(), [])
  const lease = leases.find(row => row.source === 'hn')!.lease_id
  assert.equal(await finish(randomUUID(), [job]), false)
  assert.deepEqual(await stored(), [])
  await assert.rejects(finish(lease, [{ ...job, source: 'bluesky' }]), /Mixed-source/)
  assert.equal(await finish(lease, [job, job]), true)
  const [first] = await stored()
  assert.ok(Date.parse(first.found) > Date.parse(posted))
  await assert.rejects(db.exec('update shared_hiring_jobs set first_found_at=now()'), /permission denied/)
  assert.equal(await finish(lease, []), false)
  const readyHN = () => db.exec("update shared_hiring_sources set next_check_at=now()-interval '1 minute' where source='hn'")
  await readyHN()
  const [second] = await claim()
  assert.equal(await finish(second.lease_id, [{ ...job, listing: {...job.listing, title: 'Updated contract'} }]), true)
  assert.deepEqual(await stored(), [{found: first.found, title: 'Updated contract'}])
  await readyHN()
  const [removal] = await claim()
  await query("select complete_shared_hiring_source('hn',$1,'checked',false,null,'[]',$2)", [removal.lease_id, ['101']])
  assert.deepEqual(await stored(), [{found: first.found, title: null}])
  await readyHN()
  const [reopened] = await claim()
  assert.equal(await finish(reopened.lease_id, [{ ...job, listing: {...job.listing, title: 'Updated contract'} }]), true)
  await readyHN()
  const [third] = await claim()
  assert.equal(await finish(third.lease_id, [], 'cooldown', new Date(Date.now() + 3_600_000).toISOString()), true)
  assert.deepEqual(await stored(), [{found: first.found, title: 'Updated contract'}])
  await readyHN()
  assert.deepEqual(await claim(), [])

  const observations = [job, { ...job, source: 'github', source_key: 'old', posted_at: new Date(Date.now() - 86_460_000).toISOString() },
    { ...job, source: 'github', source_key: 'future', posted_at: new Date(Date.now() + 60_000).toISOString() }]
  const accepted = await query<{date: string}>('select first_found_at::text as date from record_job_discoveries($1)', [JSON.stringify(observations)])
  assert.deepEqual(accepted, [{date: first.found}])
})
