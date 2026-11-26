import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { signTrackingJob, verifiedTrackingJob } from '../lib/job-tracking-proof'
import type { TrackableJob } from '../lib/job-tracking-model'

const listing: TrackableJob = {
  source: 'hn', url: 'https://news.ycombinator.com/item?id=1234', author: 'hiring-team',
  title: 'Hiring a contract developer', excerpt: 'Apply on employer.example.', posted_at: '2026-11-26T12:00:00Z',
}

test('tracking accepts only the signed source listing and safe original link', () => {
  const proof = signTrackingJob(listing, 'unit-test')
  assert.deepEqual(verifiedTrackingJob({ ...listing, kind: 'hiring', user_id: 'ignored' }, proof, 'unit-test'), listing)
  assert.equal(verifiedTrackingJob({ ...listing, excerpt: 'replacement' }, proof, 'unit-test'), null)
  assert.equal(verifiedTrackingJob(listing, proof, 'different-key'), null)
  assert.equal(verifiedTrackingJob(listing, '', 'unit-test'), null)
  const unsafe = { ...listing, url: 'javascript:alert(0)' }
  assert.equal(verifiedTrackingJob(unsafe, signTrackingJob(unsafe, 'unit-test'), 'unit-test'), null)
})

test('tracking reuses personal inbox rows and preserves application history and follow-ups', async () => {
  const db = new PGlite()
  const owner = randomUUID(), member = randomUUID(), other = randomUUID()
  const track = async (user: string, job: TrackableJob, applied: boolean) =>
    (await db.query<{ id: string; applied_at: string | null }>(
      'select id, applied_at::text from track_inbox_job($1,$2,$3)', [user, JSON.stringify(job), applied],
    )).rows[0]
  const asUser = async (id: string) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
    await db.exec('set role authenticated')
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
    `)
    const dir = new URL('../supabase/migrations/', import.meta.url)
    for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name, dir), 'utf8'))
    }
    for (const id of [owner, member, other]) {
      await db.query('insert into auth.users values ($1,$2)', [id, id + '@example.test'])
    }
    await db.query('insert into workspace_members(owner_id,member_id) values ($1,$2)', [owner, member])
    await db.query(`update profiles set credits=25, priority_alert_min=0, priority_email=true,
      telegram_chat_id='12345', digest_enabled=true where id=$1`, [owner])
    await db.query(`insert into lead_rules(user_id,name,min_score,draft_reply,telegram)
      values ($1,'Draft and alert',0,true,true)`, [owner])
    await db.exec('set role service_role')
    const first = await track(owner, listing, false)
    assert.equal(first.applied_at, null)
    const applied = await track(owner, listing, true)
    assert.equal(applied.id, first.id)
    assert.ok(applied.applied_at)
    assert.deepEqual(await track(owner, listing, false), applied)
    assert.deepEqual(await track(owner, listing, true), applied)
    assert.deepEqual((await db.query('select status,niche_id,intent_score,score_method from leads')).rows,
      [{ status: 'saved', niche_id: null, intent_score: null, score_method: 'manual' }])
    await db.exec('select queue_digests()')
    assert.deepEqual((await db.query("select kind from notifications where kind <> 'welcome'")).rows, [])
    assert.deepEqual((await db.query('select lead_id from lead_site_audits')).rows, [])
    assert.deepEqual((await db.query('select id from usage_events')).rows, [])
    assert.equal((await db.query<{ credits: number }>('select credits from profiles where id=$1',[owner])).rows[0].credits,25)

    const scanned = { ...listing, url: listing.url + '5' }
    const niche = randomUUID()
    await db.query("insert into niches(id,user_id,skill,keywords,sources) values($1,$2,'Writing','{writing}','{hn}')",[niche,owner])
    const legacy = await db.query<{ id: string }>(`insert into leads(user_id,niche_id,source,url,title,posted_at,intent_score,intent_reason,status)
      values ($1,$2,'hn',$3,'Existing lead',now(),82,'Original reason','replied') returning id`, [owner,niche,scanned.url])
    const legacyId = legacy.rows[0].id
    await db.query('update leads set follow_up_on=current_date+1 where id=$1',[legacyId])
    const tracked = await track(owner, scanned, true)
    assert.equal(tracked.id, legacyId)
    assert.ok(tracked.applied_at)
    assert.deepEqual((await db.query(`select title,status,intent_score,score_method,follow_up_on=current_date+1 as due
      from leads where id=$1`, [legacyId])).rows, [{title:'Existing lead',status:'replied',intent_score:82,score_method:'ai',due:true}])

    const memberSave = await track(member, listing, false)
    assert.notEqual(memberSave.id, first.id)
    const fromDetail = async (actor: string, id: string) =>
      (await db.query<{ applied_at: string | null }>('select mark_inbox_job_applied($1,$2)::text as applied_at', [actor,id])).rows[0].applied_at
    assert.equal(await fromDetail(other, first.id), null)
    assert.equal(await fromDetail(member, first.id), applied.applied_at)
    assert.ok(await fromDetail(member, memberSave.id))
    await asUser(member)
    const read = await db.query<{ id: string }>('select id from get_job_tracking($1::text[])',[[listing.url,scanned.url]])
    assert.deepEqual(read.rows, [{id:memberSave.id}])
    await assert.rejects(track(owner, listing, true), /permission denied/)
    await assert.rejects(fromDetail(member, first.id), /permission denied/)
    await assert.rejects(db.query('update leads set applied_at=now() where id=$1',[first.id]), /permission denied/)
  } finally {
    await db.close()
  }
})
