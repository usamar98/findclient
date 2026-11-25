import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { assessBuyer } from '../lib/lead-intelligence'

test('rules combine matching actions and proposal workflows stop at a booked call', async () => {
  const db = new PGlite()
  const owner = randomUUID(), member = randomUUID(), other = randomUUID(), niche = randomUUID()
  const rows = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql,params)).rows
  const count = async (sql: string, params: unknown[] = []) => (await rows<{n:number}>(sql,params))[0].n
  const lead = async (source: string, score: number, body: string) => {
    const id = randomUUID(), title = 'Looking to hire a designer'
    const intel = assessBuyer({ title, body, url:'https://example.com/post', posted_at:new Date().toISOString() })
    await rows(`insert into leads(id,user_id,niche_id,source,url,title,body,posted_at,intent_score,intent_reason,buyer_intelligence)
      values($1,$2,$3,$4,$5,$6,$7,now(),$8,'Seeking help',$9)`,
    [id,owner,niche,source,'https://example.com/'+id,title,body,score,JSON.stringify(intel)])
    return id
  }
  const asUser = async (id: string) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
    await db.exec('set role authenticated')
  }
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
    const dir = new URL('../supabase/migrations/',import.meta.url)
    for (const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(name,dir),'utf8'))
    for (const id of [owner,member,other]) await rows('insert into auth.users values($1,$2)',[id,id+'@example.org'])
    await rows('insert into workspace_members(owner_id,member_id) values($1,$2)',[owner,member])
    await rows("insert into niches(id,user_id,skill,keywords,sources) values($1,$2,'Web design','{web}','{hn,reddit}')",[niche,owner])
    await rows("update profiles set telegram_chat_id='123',priority_alert_min=90 where id=$1",[owner])
    const rule = "insert into lead_rules(user_id,name,source,niche_id,min_score,require_budget,assignee_id,draft_reply,telegram) values($1,'Paid work','hn',$2,80,true,$3,true,true)"
    await assert.rejects(rows(rule,[owner,niche,other]),/current workspace member/)
    await assert.rejects(rows(rule,[other,niche,other]),/search in your workspace/)
    await rows(rule,[owner,niche,member])
    await rows(rule,[owner,niche,owner])
    for (const [source,score,body] of [['hn',85,'No budget'],['hn',85,'Our budget is TBD'],['reddit',85,'Budget is $500'],['hn',79,'Budget is $500']] as const) {
      const id = await lead(source,score,body)
      assert.equal(await count("select count(*)::int n from notifications where payload->>'id'=$1",[id]),0)
    }
    const early = await lead('hn',85,'Our budget is $500.')
    const higher = await lead('hn',95,'Our budget is $500.')
    for (const id of [early,higher]) {
      assert.equal((await rows<{assignee_id:string}>('select assignee_id from leads where id=$1',[id]))[0].assignee_id,member)
      assert.deepEqual((await rows<{kind:string}>("select kind from notifications where payload->>'id'=$1 order by kind",[id])).map(x=>x.kind),['rule_draft','telegram'])
      assert.equal(await count("select count(*)::int n from notifications where payload->>'id'=$1 and payload->>'rule_alert'='true'",[id]),1)
    }
    const [job] = await rows<{id:string}>("select id from notifications where kind='rule_draft' and payload->>'id'=$1",[early])
    const requestKey = 'reply:' + early + ':' + job.id
    await rows('update profiles set credits=2 where id=$1',[owner])
    for (let i=0;i<2;i++) {
      const [reserve] = await rows<{state:string}>("select reserve_rule_draft($1) state",[job.id])
      if (reserve.state === 'reserved') await rows("select finalize_reply($1,$2,$3,$4,'friendly','First step','My draft')",[owner,requestKey,early,job.id])
    }
    assert.equal(await count('select credits n from profiles where id=$1',[owner]),1)
    assert.equal(await count('select count(*)::int n from responses where id=$1',[job.id]),1)
    // A rule-triggered reply from a manual scan must share that scan's hard credit cap.
    for (const limit of [2,1]) {
      await rows('update profiles set credits=$1 where id=$2',[limit===2 ? 2 : 10,owner])
      const runId = randomUUID()
      await rows('select start_manual_scan($1,$2,$3,$4)',[owner,niche,runId,limit])
      const [scan] = await rows<{id:string;lease:string}>("select id,lease from claim_run_scan_jobs($1,5) where source='hn'",[runId])
      const url = 'https://news.ycombinator.com/item?id='+limit
      const [key] = await rows<{id:string}>("select 'score:'||encode(sha256(convert_to($1||chr(10)||$2,'UTF8')),'hex') as id",[niche,url])
      const [reserved] = await rows<{state:string}>('select reserve_scan_score($1,$2,$3) state',[scan.id,scan.lease,key.id])
      assert.equal(reserved.state,'reserved')
      const body = 'Our budget is $500.', title = 'Looking to hire a developer', posted = new Date().toISOString()
      const payload = {niche_id:niche,url,title,body,source:'hn',posted_at:posted,intent_reason:'Looking to hire',intent_score:83,
        problem_summary:'A new store',buyer_intelligence:assessBuyer({url,title,body,posted_at:posted})}
      await rows('select finalize_scan_score($1,$2,$3)',[owner,key.id,JSON.stringify(payload)])
      const [saved] = await rows<{id:string}>('select id from leads where url=$1',[url])
      const [event] = await rows<{id:string}>("select id from notifications where kind='rule_draft' and payload->>'id'=$1",[saved.id])
      const reserveDraft = async () => (await rows<{state:string}>('select reserve_rule_draft($1) state',[event.id]))[0].state
      const draftKey = 'reply:'+saved.id+':'+event.id
      if (limit===2) {
        assert.equal(await count('select credits n from profiles where id=$1',[owner]),1)
        assert.equal(await reserveDraft(),'reserved')
        assert.equal(await reserveDraft(),'busy')
        assert.equal(await count('select scan_allowance($1) n',[runId]),0)
        await rows('select refund_usage($1,$2)',[owner,draftKey])
        assert.equal(await count('select scan_allowance($1) n',[runId]),1)
        assert.equal(await reserveDraft(),'reserved')
        await rows("select finalize_reply($1,$2,$3,$4,'friendly','First step','My draft')",[owner,draftKey,saved.id,event.id])
        assert.equal(await reserveDraft(),'settled')
        assert.equal(await count('select credits n from profiles where id=$1',[owner]),0)
      } else {
        assert.equal(await reserveDraft(),'cap_reached')
        assert.equal(await reserveDraft(),'cap_reached')
        assert.equal(await count('select credits n from profiles where id=$1',[owner]),9)
        assert.equal((await rows<{rule_draft_capped:boolean}>('select rule_draft_capped from leads where id=$1',[saved.id]))[0].rule_draft_capped,true)
      }
      assert.deepEqual(await rows('select spent,scored,drafted,draft_skipped from scan_run_sources where job_id=$1',[scan.id]),
        [{spent:limit,scored:1,drafted:limit-1,draft_skipped:2-limit}])
      await rows('update scan_jobs set done_at=now() where run_id=$1',[runId])
    }
    const publishOpen = async (id: string) => {
      const token = randomUUID()
      await rows(`insert into lead_proposals(lead_id,document,published_document,share_token)
        values($1,'{}','{"title":"Store redesign","recipient":"Alex"}',$2)`,[id,token])
      for (let i=0;i<2;i++) await rows('select record_proposal_open($1,$2)',[token,randomUUID()])
    }
    await publishOpen(early); await publishOpen(higher)
    assert.equal(await count("select count(*)::int n from notifications where kind='proposal_open'"),2)
    assert.equal(await count("select count(*)::int n from proposal_followups where due_at>now()+interval '2 days 23 hours'"),2)
    await rows("update leads set status='call_booked' where id=$1",[early])
    await rows("update leads set status='proposal_sent' where id=$1",[early])
    await db.exec("update proposal_followups set due_at=now()-interval '1 day'")
    assert.equal(await count('select prepare_proposal_followups() n'),1)
    assert.equal(await count('select prepare_proposal_followups() n'),0)
    await asUser(member)
    assert.deepEqual(await rows('select id from lead_rules'),[])
    assert.equal((await rows<{draft:string}>('select draft from proposal_followups where lead_id=$1',[higher]))[0].draft.includes('Alex'),true)
    assert.equal((await rows("update proposal_followups set draft='Edited follow-up' where lead_id=$1 returning lead_id",[higher])).length,1)
    await asUser(other)
    assert.equal((await rows('select lead_id from proposal_followups')).length,0)
    await assert.rejects(rows('select prepare_proposal_followups()'),/permission denied/)
    await db.exec('reset role')
    await rows("insert into proposal_workflow_settings values($1,false,3)",[owner])
    const disabled = await lead('hn',82,'Our budget is $500.')
    await publishOpen(disabled)
    assert.equal(await count('select count(*)::int n from proposal_followups where lead_id=$1',[disabled]),0)
  } finally { await db.close() }
})
