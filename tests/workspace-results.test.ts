import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import type { WorkspaceResult } from '../lib/workspace-results'

test('results retain actual CRM milestones, attribute settled costs and enforce workspace privacy', async () => {
  const db = new PGlite()
  const owner = randomUUID(), member = randomUUID(), outsider = randomUUID()
  const niche = randomUUID(), lead = randomUUID(), reply = randomUUID()
  const report = async (group = 'platform') =>
    (await db.query<WorkspaceResult>('select * from workspace_results($1,$2)', [owner, group])).rows
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
    const migrations = (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()
    for (const file of migrations) {
      if (file.endsWith('_workspace_results.sql')) {
        for (const id of [owner, member, outsider]) {
          await db.query('insert into auth.users values($1,$2)', [id, id + '@example.com'])
        }
        await db.query('insert into workspace_members(owner_id,member_id) values($1,$2)', [owner, member])
        await db.query("insert into niches(id,user_id,skill,keywords,sources) values($1,$2,'Web design','{design}','{hn,reddit}')", [niche,owner])
        await db.query(`insert into leads (id,user_id,niche_id,source,url,title,posted_at,intent_score,intent_reason,status)
          values($1,$2,$3,'hn','https://example.com/project','Site redesign',now(),80,'Request for proposal','replied')`, [lead,owner,niche])
        await db.query(`insert into usage_events(user_id,request_key,type,cost_credits,settled_at)
          values($1,'score:' || encode(sha256(convert_to($2 || chr(10) || 'https://example.com/project','UTF8')),'hex'),'score',1,now()),
                ($1,'score:unknown','score',1,now()), ($1,'unsettled','score',8,null)`, [owner,niche])
        await db.query(`insert into responses (id,user_id,lead_id,tone,solution_md,pitch_md)
          values ($1,$2,$3,'expert','Solution','Pitch')`, [reply,owner,lead])
        await db.query("insert into usage_events(user_id,request_key,type,cost_credits,settled_at) values($1,$2,'response',1,now())",
          [owner,'reply:' + lead + ':' + reply])
      }
      await db.exec(await readFile(new URL(file, dir), 'utf8'))
    }
    await db.query("update leads set status='call_booked' where id=$1", [lead])
    await db.query("update leads set status='won',deal_value_cents=65099 where id=$1", [lead])
    // A fully scored candidate may produce no lead at all.
    await db.query(`insert into usage_events(user_id,request_key,type,cost_credits,settled_at,niche_id,source)
      values($1,'score:low','score',1,now(),$2,'reddit')`, [owner,niche])
    await db.query(`insert into usage_events(user_id,request_key,type,cost_credits)
      values($1,'another-reply','response',1)`, [owner])
    await db.query("select finalize_reply($1,'another-reply',$2,$3,'friendly','Solution','Pitch')", [owner,lead,randomUUID()])
    await asUser(owner)
    const platform = await report()
    const hackerNews = platform.find(row => row.group_id === 'hn')!
    assert.deepEqual([hackerNews.leads_found,hackerNews.replies,hackerNews.calls,hackerNews.wins,hackerNews.revenue_cents],
      [1,1,1,1,65099])
    assert.equal(hackerNews.score_credits,1)
    assert.equal(hackerNews.reply_credits,2)
    assert.equal(platform.find(row => row.group_id === 'reddit')?.score_credits,1)
    assert.equal(platform.find(row => row.group_id === null)?.score_credits,1)
    const search = (await report('search')).find(row => row.group_id === niche)!
    assert.equal(search.search_name,'Web design')
    assert.equal(search.score_credits,2)
    await asUser(member)
    assert.deepEqual((await report()).map(row => [row.group_id,row.wins,row.score_credits,row.reply_credits]),
      [['hn',1,null,null]])
    await db.query("update leads set status='lost' where id=$1", [lead])
    const [lost] = await report()
    assert.deepEqual([lost.replies,lost.calls,lost.wins,lost.revenue_cents], [1,1,0,0])
    await asUser(outsider)
    assert.deepEqual(await report(),[])
  } finally {
    await db.close()
  }
})
