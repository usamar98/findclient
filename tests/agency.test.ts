import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('teams share lead work, keep billing private and deliver reminders to the current assignee', async () => {
  const db = new PGlite()
  const rows = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows
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
    for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name, dir), 'utf8'))
    }
    const owner = randomUUID(), member = randomUUID(), other = randomUUID()
    for (const id of [owner, member, other]) {
      await db.query('insert into auth.users values($1,$2)', [id, id + '@agency.test'])
    }
    const niche = randomUUID(), lead = randomUUID()
    await db.query("insert into niches(id,user_id,skill,keywords,sources) values($1,$2,'Webflow','{CMS}','{hn}')", [niche, owner])
    await db.query(`insert into leads(id,user_id,niche_id,source,url,title,posted_at,intent_score,intent_reason)
      values($1,$2,$3,'hn','https://example.com/project','Website build',now(),75,'Hiring a designer')`, [lead,owner,niche])
    await db.query("insert into responses(lead_id,user_id,solution_md,pitch_md,tone) values($1,$2,'First step','Original draft','expert')", [lead,owner])
    const [{ invite }] = (await db.query<{ invite: string }>('select invite_workspace_member($1,$2) as invite',
      [owner, member.toUpperCase() + '@AGENCY.TEST'])).rows
    assert.deepEqual(await rows('select accept_workspace_invite($1,$2) as ok', [invite,other]), [{ ok:false }])
    await asUser(member)
    assert.equal((await rows('select id from leads')).length,0)
    assert.equal((await rows('select id from workspace_invites')).length,1)
    await assert.rejects(rows('select invite_workspace_member($1,$2)', [owner,'bad@test.com']), /permission denied/)
    await db.exec('reset role')
    assert.deepEqual(await rows('select accept_workspace_invite($1,$2) as ok', [invite,member]), [{ ok:true }])
    assert.deepEqual(await rows('select accept_workspace_invite($1,$2) as ok', [invite,member]), [{ ok:false }])
    await asUser(member)
    assert.deepEqual(await rows('select id from profiles'), [{ id:member }])
    assert.deepEqual(await rows('select id from leads'), [{ id:lead }])
    assert.equal((await rows("update responses set pitch_md='Team draft' where lead_id=$1 returning id",[lead])).length,1)
    await assert.rejects(rows('update leads set assignee_id=$1 where id=$2', [other,lead]), /Assignee/)
    await rows("update leads set status='call_booked',deal_value_cents=450050,assignee_id=$1,follow_up_on=current_date where id=$2", [member,lead])
    await db.exec('reset role')
    assert.deepEqual(await rows("select user_id from notifications where kind='follow_up'"), [{ user_id:member }])
    await asUser(member)
    await rows("update leads set status='won' where id=$1", [lead])
    assert.deepEqual(await rows('select revenue_cents::text from pipeline_totals($1)', [owner]), [{ revenue_cents:'450050' }])
    assert.deepEqual(await rows('select by_source from pipeline_totals($1)', [owner]), [{ by_source:[{ source:'hn',wins:1,amount_cents:450050 }] }])
    await rows("update leads set status='lost' where id=$1", [lead])
    assert.deepEqual(await rows('select revenue_cents::text from pipeline_totals($1)', [owner]), [{ revenue_cents:'0' }])
    await db.exec('reset role')
    assert.equal((await rows("select id from notifications where kind='follow_up'")).length,0)
    await asUser(other)
    assert.equal((await rows('select id from leads')).length,0)
    assert.equal((await rows("update responses set pitch_md='Other draft' returning id")).length,0)
    assert.equal((await rows("update leads set status='won' where id=$1 returning id",[lead])).length,0)
    assert.equal((await rows('delete from workspace_members returning member_id')).length,0)
    await asUser(owner)
    await rows("update leads set status='replied',follow_up_on=current_date+1 where id=$1", [lead])
    await rows('delete from workspace_members where member_id=$1', [member])
    await asUser(member)
    assert.equal((await rows('select id from leads')).length,0)
    await db.exec('reset role')
    assert.deepEqual(await rows("select user_id from notifications where kind='follow_up'"), [{ user_id:owner }])
    assert.deepEqual(await rows('select assignee_id from leads'), [{ assignee_id:null }])

    await rows("update profiles set plan='lifetime' where id=$1", [owner])
    const input = {skill:'Copywriting',keywords:['copy'],negative_keywords:[],sources:['hn'],
      min_intent:65,active:true,portfolio_url:'',pitch_style:''}
    for(let i=0;i<2;i++) await rows('select save_niche($1,null,$2::jsonb)',[owner,JSON.stringify(input)])
    await assert.rejects(rows('select save_niche($1,null,$2::jsonb)',[owner,JSON.stringify(input)]),/Niche limit/)
    const watch = { ...input,hn_threads:['42'],subreddits:['webflow'] }
    await rows('select save_niche($1,$2,$3::jsonb)',[owner,niche,JSON.stringify(watch)])
    await rows('select save_niche($1,$2,$3::jsonb)',[owner,niche,JSON.stringify(input)])
    assert.deepEqual(await rows('select hn_threads,subreddits from niches where id=$1',[niche]),
      [{hn_threads:['42'],subreddits:['webflow']}])
    await assert.rejects(rows('select save_niche($1,$2,$3::jsonb)',[owner,niche,JSON.stringify({...watch,subreddits:['invalid!']})]),/constraint/)
    await rows('select save_niche($1,$2,$3::jsonb)',[owner,niche,JSON.stringify({...watch,subreddits:[]})])
    assert.deepEqual(await rows('select subreddits from niches where id=$1',[niche]),[{subreddits:[]}])
  } finally {
    await db.close()
  }
})
