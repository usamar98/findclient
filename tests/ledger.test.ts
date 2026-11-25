import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import { LIFETIME_ENDS_AT, lifetimeLastDay } from '../lib/offers'

const db = new PGlite()
const query = async <T>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows

async function newUser(startingCredits = 0) {
  const id = randomUUID()
  await db.query('insert into auth.users(id,email) values($1,$2)', [
    id,
    id + '@example.org',
  ])
  if (startingCredits > 0) {
    await db.query('update profiles set credits=$1 where id=$2', [startingCredits, id])
  }
  return id
}

async function balance(user: string) {
  const [profile] = await query<{ credits: number }>(
    'select credits from profiles where id=$1',
    [user],
  )
  return profile.credits
}

async function reserve(user: string, key: string, cost: number) {
  const [result] = await query<{ ok: boolean }>(
    "select reserve_usage($1,$2,'score',$3) as ok",
    [user, key, cost],
  )
  return result.ok
}

async function quote(user: string, product: string) {
  const [result] = await query<{ id: string; amount: number; credits: number }>(
    'select id,amount,credits from create_quote($1,$2)',
    [user, product],
  )
  return result
}

async function fulfill(
  user: string,
  quoteId: string,
  amount: number,
  session: string,
) {
  const [result] = await query<{ ok: boolean }>(
    'select fulfill_checkout($1,$2,$3,$4,$5) as ok',
    [quoteId, session, amount, user, 'cus_test'],
  )
  return result.ok
}

describe('Lead To Client Postgres ledger', { concurrency: false }, () => {
  before(async () => {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    `)
    const directory = new URL('../supabase/migrations/', import.meta.url)
    const migrations = (await readdir(directory))
      .filter((file) => file.endsWith('.sql'))
      .sort()
    assert.ok(migrations.length)
    for (const file of migrations) {
      await db.exec(await readFile(new URL(file, directory), 'utf8'))
    }
  })
  after(async () => {
    await db.close()
  })

  it('admits one debit for duplicate attempts and caps outstanding charges at the balance', async () => {
    const user = await newUser(15)
    assert.equal(await balance(user), 15)
    const duplicates = await Promise.all(
      Array.from({ length: 6 }, () => reserve(user, 'same-post', 3)),
    )
    assert.equal(duplicates.filter(Boolean).length, 1)
    const competing = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserve(user, 'post-' + i, 3)),
    )
    assert.equal(competing.filter(Boolean).length, 4)
    assert.equal(await balance(user), 0)
    const [usage] = await query<{ count: number; total: number }>(
      'select count(*)::int as count,sum(cost_credits)::int as total from usage_events where user_id=$1',
      [user],
    )
    assert.deepEqual(usage, { count: 5, total: 15 })
    await assert.rejects(reserve(user, 'invalid', -1), /invalid cost/i)
  })

  it('refunds only the matching owner once and allows a failed operation to retry', async () => {
    const owner = await newUser(15)
    const other = await newUser(15)
    assert.equal(await reserve(owner, 'request', 4), true)
    await db.query('select refund_usage($1,$2)', [other, 'request'])
    assert.equal(await balance(owner), 11)
    assert.equal(await balance(other), 15)
    await Promise.all(
      [1, 2].map(() =>
        db.query('select refund_usage($1,$2)', [owner, 'request']),
      ),
    )
    assert.equal(await balance(owner), 15)
    assert.equal(await reserve(owner, 'request', 4), true)
    assert.equal(await balance(owner), 11)
  })

  it('settles a score and its result together and restores abandoned reservations', async () => {
    const owner = await newUser(15)
    const [{ id: niche }] = await query<{ id: string }>(
      "insert into niches(user_id,skill,keywords,sources) values($1,'Shopify developer',array['theme'],array['shopify']) returning id",
      [owner],
    )
    const post = {
      niche_id: niche,
      source: 'shopify',
      url: 'https://example.org/help',
      author: 'a',
      title: 'Theme help',
      body: 'A merchant asks for help.',
      posted_at: new Date().toISOString(),
      intent_score: 82,
      intent_reason: 'Specific request',
      problem_summary: 'Theme issue',
      budget_signal: 'Unknown',
      urgency: 'Unknown',
    }
    await reserve(owner, 'credited', 1)
    const finalize = () =>
      query<{ ok: boolean }>('select finalize_score($1,$2,$3::jsonb) as ok', [
        owner,
        'credited',
        JSON.stringify(post),
      ])
    assert.equal((await finalize())[0].ok, true)
    assert.equal((await finalize())[0].ok, false)
    await db.query('select refund_usage($1,$2)', [owner, 'credited'])
    await reserve(owner, 'below_threshold', 1)
    await db.query('select finalize_score($1,$2,null)', [
      owner,
      'below_threshold',
    ])
    await reserve(owner, 'interrupted', 1)
    await db.query(
      "update usage_events set created_at=now()-interval '1 hour' where user_id=$1",
      [owner],
    )
    await db.exec('select refill_credits(); select refill_credits();')
    assert.equal(await balance(owner), 13)
    const leads = await query<{ id: string }>(
      'select id from leads where user_id=$1',
      [owner],
    )
    assert.equal(leads.length, 1)
    const replyId = randomUUID()
    await db.query("select reserve_usage($1,'reply','response',1)", [owner])
    const persistReply = () =>
      query<{ ok: boolean }>(
        "select finalize_reply($1,'reply',$2,$3,'friendly','A fix','A pitch') as ok",
        [owner, leads[0].id, replyId],
      )
    assert.equal((await persistReply())[0].ok, true)
    assert.equal((await persistReply())[0].ok, false)
    const rows = await query('select id from responses where user_id=$1', [
      owner,
    ])
    assert.equal(rows.length, 1)
    assert.equal(await balance(owner), 12)
  })

  it('checks quote ownership and amount and fulfills a paid session exactly once', async () => {
    const owner = await newUser(15)
    const other = await newUser()
    await assert.rejects(quote(owner, 'agency'), /retired/i)
    // An already-issued agency quote can still settle after the migration.
    const [order] = await query<{
      id: string
      amount: number
      credits: number
    }>(
      "insert into checkout_quotes(user_id,product,amount,credits,expires_at) values($1,'agency',19900,500,now()+interval '15 minutes') returning id,amount,credits",
      [owner],
    )
    assert.equal(order.amount, 19900)
    await assert.rejects(fulfill(other, order.id, order.amount, 'cs_other'))
    await assert.rejects(
      fulfill(owner, order.id, 1, 'cs_bad'),
      /amount mismatch/i,
    )
    assert.equal(await balance(owner), 15)
    const replay = await Promise.all(
      [1, 2].map(() => fulfill(owner, order.id, order.amount, 'cs_agency')),
    )
    assert.deepEqual(replay.sort(), [false, true])
    assert.equal(await balance(owner), 15 + order.credits)
    const [entitlement] = await query<{ plan: string; refill: boolean }>(
      'select plan,next_refill_at is not null as refill from profiles where id=$1',
      [owner],
    )
    assert.deepEqual(entitlement, { plan: 'agency', refill: true })
    await assert.rejects(quote(owner, 'monthly'), /offer ended/i)
    const [receipt] = await query<{ count: number }>(
      "select count(*)::int as count from notifications where user_id=$1 and kind='receipt'",
      [owner],
    )
    assert.equal(receipt.count, 1)
    await db.query(
      "update profiles set next_refill_at=now()-interval '1 hour' where id=$1",
      [owner],
    )
    await db.exec('select refill_credits(); select refill_credits();')
    assert.equal(await balance(owner), 15 + order.credits * 2)
    const topup = await quote(owner, 'topup9')
    await assert.rejects(fulfill(owner, topup.id, topup.amount, 'cs_agency'))
    assert.equal(await balance(owner), 15 + order.credits * 2)
    assert.ok(await fulfill(owner, topup.id, topup.amount, 'cs_topup'))
    assert.equal(await balance(owner), 15 + order.credits * 2 + topup.credits)
  })

  it('uses completed lifetime sales for tier boundaries and reserves the final spot', async () => {
    const buyer = await newUser()
    assert.equal(await balance(buyer), 0)
    assert.equal(await reserve(buyer, 'before-first-purchase', 1), false)
    const next = await newUser()
    const prices = async () =>
      (
        await query<{ sales: number; price: number; spots: number }>(
          'select * from lifetime_price()',
        )
      )[0]
    const [deadline] = await query<{ ends: string }>(
      "select sale_ends_at::text as ends from product_config where product='lifetime'",
    )
    assert.equal(new Date(deadline.ends).toISOString(), LIFETIME_ENDS_AT)
    assert.equal(LIFETIME_ENDS_AT, '2026-12-16T19:00:00.000Z')
    assert.equal(lifetimeLastDay, 'December 16, 2026')
    await db.exec(
      "update product_config set sale_ends_at=now()-interval '1 second' where product='lifetime'",
    )
    await assert.rejects(quote(buyer, 'lifetime'), /offer ended/i)
    await db.exec(
      "update product_config set sale_ends_at=now()+interval '1 day' where product='lifetime'",
    )
    assert.deepEqual(await prices(), { sales: 0, price: 149, spots: 10 })
    await db.query(
      `insert into purchases (user_id,stripe_session_id,product,amount)
      select $1,'cs_tier_'||i,'lifetime',14900 from generate_series(1,9) i`,
      [buyer],
    )
    const last = await quote(buyer, 'lifetime')
    assert.equal(last.amount, 14900)
    assert.deepEqual(await prices(), { sales: 9, price: 149, spots: 1 })
    await assert.rejects(quote(next, 'lifetime'), /spots/i)
    assert.ok(await fulfill(buyer, last.id, last.amount, 'cs_tier_last'))
    assert.equal(await balance(buyer), last.credits)
    assert.deepEqual(await prices(), { sales: 10, price: 159, spots: 10 })
    const later = await quote(next, 'lifetime')
    assert.equal(later.amount, 15900)
    await db.query(
      `insert into purchases (user_id,stripe_session_id,product,amount)
      select $1,'cs_next_'||i,'lifetime',15900 from generate_series(1,10) i`,
      [buyer],
    )
    assert.deepEqual(await prices(), { sales: 20, price: 169, spots: 10 })
  })

  it('closes new monthly quotes and honors invoices and cancellations for earlier quotes', async () => {
    const user = await newUser(15)
    await db.exec(
      "update product_config set sale_ends_at=now()+interval '1 day' where product='lifetime'",
    )
    await assert.rejects(quote(user, 'monthly'), /offer ended/i)
    const historicalQuote = async () =>
      (await query<{ id: string }>(
        "insert into checkout_quotes(user_id,product,amount,credits,expires_at) values($1,'monthly',4900,150,now()-interval '1 day') returning id",
        [user],
      ))[0]
    const order = await historicalQuote()
    await db.query(
      "update profiles set stripe_customer_id='cus_monthly' where id=$1",
      [user],
    )
    const pay = (invoice: string, period: string, customer = 'cus_monthly') =>
      db.query(
        "select apply_subscription_invoice($1,$2,'sub_monthly',$3,4900,$4::timestamptz)",
        [order.id, invoice, customer, period],
      )
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString()
    await assert.rejects(
      pay('in_first', periodEnd, 'cus_other'),
      /customer mismatch/i,
    )
    await pay('in_first', periodEnd)
    await pay('in_first', periodEnd)
    assert.equal(await balance(user), 165)
    await assert.rejects(quote(user, 'lifetime'), /already owned/i)
    const plan = async () =>
      (
        await query<{ plan: string }>('select plan from profiles where id=$1', [
          user,
        ])
      )[0].plan
    assert.equal(await plan(), 'monthly')
    await db.query(
      "update checkout_quotes set paid_through=now()-interval '1 minute' where id=$1",
      [order.id],
    )
    await db.exec('select refill_credits()')
    assert.equal(await plan(), 'free')
    await assert.rejects(quote(user, 'lifetime'), /existing plan/i)
    await pay('in_renewal', periodEnd)
    assert.equal(await plan(), 'monthly')
    await db.query("select end_subscription($1,'sub_monthly','cus_monthly')", [
      order.id,
    ])
    await pay('in_renewal', periodEnd)
    assert.equal(await balance(user), 315)
    assert.equal(await plan(), 'free')
    await assert.rejects(quote(user, 'monthly'), /offer ended/i)
    const restarted = await historicalQuote()
    await db.query("select end_subscription($1,'sub_new','cus_monthly')", [
      restarted.id,
    ])
    await db.query(
      "select apply_subscription_invoice($1,'in_late','sub_new','cus_monthly',4900,$2)",
      [restarted.id, periodEnd],
    )
    assert.equal(await plan(), 'free')
    assert.equal(await balance(user), 465)
  })

  it('enforces row and column permissions for authenticated and anonymous callers', async () => {
    const owner = await newUser()
    const other = await newUser(15)
    const scope = await query<{ id: string }>(
      "insert into niches(user_id,skill,keywords,sources) values($1,'Designer','{}',array['reddit']) returning id",
      [owner],
    )
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ])
    await db.exec('set role authenticated')
    try {
      const users = await query<{ id: string }>('select id from profiles')
      assert.deepEqual(users, [{ id: other }])
      assert.deepEqual(
        await query('select id from niches where id=$1', [scope[0].id]),
        [],
      )
      assert.deepEqual(
        await query(
          "update profiles set name='Other' where id=$1 returning id",
          [owner],
        ),
        [],
      )
      await assert.rejects(
        db.query('update profiles set credits=1000 where id=$1', [other]),
        /permission denied/i,
      )
      await assert.rejects(
        reserve(owner, 'unauthorized', 1),
        /permission denied/i,
      )
      await assert.rejects(
        db.query('select * from checkout_quotes'),
        /permission denied/i,
      )
      await db.exec('reset role; set role anon;')
      await assert.rejects(
        db.query('select * from profiles'),
        /permission denied/i,
      )
      await assert.rejects(
        db.query('select refill_credits()'),
        /permission denied/i,
      )
    } finally {
      await db.exec('reset role')
    }
    const exposed = await query<{ relname: string }>(`
      select relname from pg_class where relnamespace='public'::regnamespace
      and relkind='r' and not relrowsecurity`)
    assert.deepEqual(exposed, [])
    assert.equal(await balance(other), 15)
  })

  it('enqueues a niche once per source and hour and honors a shared search-provider cooldown', async () => {
    const user = await newUser(15)
    const settings = {
      skill: 'Shopify developer',
      keywords: ['variant image'],
      negative_keywords: [],
      sources: ['hn', 'reddit'],
      active: true,
      min_intent: 60,
      pitch_style: '',
      portfolio_url: '',
    }
    const [{ niche }] = await query<{ niche: string }>(
      'select save_niche($1,null,$2::jsonb) as niche',
      [user, JSON.stringify(settings)],
    )
    await db.exec(
      "select enqueue_scans(); select enqueue_scans(); select defer_source('exa',now()+interval '10 minutes');",
    )
    const jobs = await query<{ source: string }>(
      'select source from scan_jobs where niche_id=$1 order by source',
      [niche],
    )
    assert.deepEqual(jobs, [{ source: 'hn' }, { source: 'reddit' }])
    const claimed = await query<{ source: string; lease: string }>(
      'select source,lease from claim_scan_jobs(100) where niche_id=$1',
      [niche],
    )
    assert.equal(claimed.length, 1)
    assert.equal(claimed[0].source, 'hn')
    assert.ok(claimed[0].lease)
    const second = await query(
      'select id from claim_scan_jobs(100) where niche_id=$1',
      [niche],
    )
    assert.equal(second.length, 0)
    await assert.rejects(
      db.query('select save_niche($1,null,$2::jsonb)', [
        user,
        JSON.stringify(settings),
      ]),
      /niche limit/i,
    )
  })

  it('consumes a Telegram connection code once and queues only qualifying alerts and opted-in digests', async () => {
    const user = await newUser()
    const [{ id: niche }] = await query<{ id: string }>(
      "insert into niches(user_id,skill,keywords,sources) values($1,'Designer',array['design'],array['hn']) returning id",
      [user],
    )
    await db.query(
      "insert into telegram_codes values('one-time-test-code',$1,now()+interval '5 minutes')",
      [user],
    )
    assert.deepEqual(
      await query("select link_telegram('one-time-test-code','123') as linked"),
      [{ linked: true }],
    )
    assert.deepEqual(
      await query("select link_telegram('one-time-test-code','456') as linked"),
      [{ linked: false }],
    )
    for (const score of [79, 80]) {
      await db.query(
        "insert into leads(user_id,niche_id,source,url,title,posted_at,intent_score,intent_reason) values($1,$2,'hn',$3,'Need design help',now(),$4,'A request for design')",
        [user, niche, 'https://example.org/' + score, score],
      )
    }
    const count = (kind: string) =>
      query(
        'select count(*)::int as n from notifications where user_id=$1 and kind=$2',
        [user, kind],
      )
    assert.deepEqual(await count('telegram'), [{ n: 1 }])
    await db.exec('select queue_digests()')
    assert.deepEqual(await count('digest'), [{ n: 0 }])
    await db.query('update profiles set digest_enabled=true where id=$1', [
      user,
    ])
    await db.exec('select queue_digests(); select queue_digests()')
    assert.deepEqual(await count('digest'), [{ n: 1 }])
  })

  it('uses source-specific scan slots and sends enabled priority channels only for open qualified leads', async () => {
    const owner = await newUser(15)
    const id = randomUUID()
    await db.query("insert into niches(id,user_id,skill,keywords,sources) values($1,$2,'designer','{design}','{hn,stackexchange}')",[id,owner])
    await db.query("select save_alert_settings($1,true,true,85,'https://hooks.slack.com/services/T/B/test')",[owner])
    await db.exec('select enqueue_scans(); select enqueue_scans()')
    const slots = await query("select source, scan_hour = case when source='hn' then date_bin(interval '10 minutes',now(),'2000-01-01'::timestamptz) else date_trunc('hour',now()) end as correct from scan_jobs where niche_id=$1 order by source",[id])
    assert.deepEqual(slots,[{source:'hn',correct:true},{source:'stackexchange',correct:true}])
    for (const [label, score, state] of [['low',79,'visible'],['open',85,'visible'],['closed',95,'closed']] as const) {
      await db.query("insert into leads(user_id,niche_id,source,url,title,posted_at,intent_score,intent_reason,buyer_intelligence) values($1,$2,'hn',$3,$4,now(),$5,'Evidence',$6::jsonb)",
        [owner,id,'https://example.org/'+label,label,score,JSON.stringify({availability:{state}})])
    }
    assert.deepEqual(await query("select kind,payload->>'title' as title from notifications where user_id=$1 and kind in ('priority_email','telegram','webhook') order by kind",[owner]),
      [{kind:'priority_email',title:'open'},{kind:'webhook',title:'open'}])
    await db.query("select save_alert_settings($1,false,false,90,null)",[owner])
    assert.deepEqual(await query('select count(*)::integer as n from alert_destinations where user_id=$1',[owner]),[{n:1}])
    await db.query("select save_alert_settings($1,false,false,90,'')",[owner])
    assert.deepEqual(await query('select count(*)::integer as n from alert_destinations where user_id=$1',[owner]),[{n:0}])
    await db.exec('set role authenticated')
    try {
      await assert.rejects(db.query('select * from alert_destinations'),/permission denied/i)
      await assert.rejects(db.query("select save_alert_settings($1,false,false,1,'')",[owner]),/permission denied/i)
    } finally { await db.exec('reset role') }
  })

  it('refills each due lifetime account once and keeps free accounts at their existing balance', async () => {
    const free = await newUser(15)
    const solo = await newUser(15)
    const agency = await newUser(15)
    await db.query(
      "update profiles set plan=case when id=$1 then 'lifetime' else 'agency' end, next_refill_at=now()-interval '1 hour' where id in ($1,$2)",
      [solo, agency],
    )
    await db.exec('select refill_credits(); select refill_credits()')
    assert.equal(await balance(free), 15)
    assert.equal(await balance(solo), 165)
    assert.equal(await balance(agency), 515)
  })

  it('queues website checks once, isolates audit results, and learns only from opted-in human edits', async () => {
    const owner = await newUser(), other = await newUser()
    const [niche] = await query<{ id: string }>("insert into niches(user_id,skill,keywords,sources) values($1,'Design','{}',array['hn']) returning id", [owner])
    const [lead] = await query<{ id: string }>(`insert into leads(user_id,niche_id,source,url,title,body,posted_at,intent_score,intent_reason)
      values ($1,$2,'hn','https://news.ycombinator.com/item?id=123','Store project','Our site: https://example.org',now(),83,'Looking for a designer') returning id`, [owner,niche.id])
    const [lease] = await query<{lease: string}>('select lease from claim_lead_audits($1,1)', [lead.id])
    assert.ok(lease.lease)
    assert.deepEqual(await query('select * from claim_lead_audits($1,1)', [lead.id]), [])
    await db.query("update lead_site_audits set status='complete' where lead_id=$1 and lease=$2", [lead.id,lease.lease])
    const [reply] = await query<{ id: string }>("insert into responses(user_id,lead_id,solution_md,pitch_md,tone) values($1,$2,'Model solution','Model pitch','short') returning id", [owner,lead.id])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner])
    await db.exec('set role authenticated')
    try {
      await db.query("update responses set solution_md='Manual edit before opt-in' where id=$1", [reply.id])
      assert.deepEqual(await query('select voice_sample from responses where id=$1',[reply.id]), [{voice_sample:null}])
      await db.query('update profiles set learn_from_edits=true where id=$1', [owner])
      await db.query("update responses set pitch_md='My own phrasing.' where id=$1", [reply.id])
      assert.deepEqual(await query('select voice_author_id,voice_sample from responses where id=$1',[reply.id]), [{voice_author_id:owner,voice_sample:'My own phrasing.'}])
      assert.deepEqual(await query('select status from lead_site_audits where lead_id=$1',[lead.id]), [{status:'complete'}])
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other])
      assert.deepEqual(await query('select * from lead_site_audits where lead_id=$1',[lead.id]), [])
      await assert.rejects(query('select * from claim_lead_audits($1,1)', [lead.id]), /permission denied/i)
    } finally { await db.exec('reset role') }
  })

  it('shares manual and scheduled scoring limits, refunds failed calls, and keeps durable scan receipts', async () => {
    const owner = await newUser(5), stranger = await newUser(5)
    const [{ id: niche }] = await query<{id: string}>(
      "insert into niches(user_id,skill,keywords,sources,active) values($1,'Design',array['hiring'],array['hn','shopify'],false) returning id", [owner],
    )
    const start = (actor: string, token: string, cap: number) =>
      query<{id: string}>('select start_manual_scan($1,$2,$3,$4) as id', [actor, niche, token, cap])
    const request = randomUUID()
    await assert.rejects(start(stranger, request, 2))
    await db.query('select save_scan_budget($1,null,3)', [owner])
    await assert.rejects(db.query('select save_scan_budget($1,$2,0)', [stranger,niche]))
    const [{ id: run }] = await start(owner, request, 2)
    assert.equal(run, request)
    assert.equal((await start(owner, request, 2))[0].id, run)
    assert.equal((await start(owner, randomUUID(), 8))[0].id, run)
    const jobs = await query<{id: string; lease: string}>('select * from claim_run_scan_jobs($1,8)', [run])
    assert.equal(jobs.length, 2)
    const charge = async (job: typeof jobs[number], key: string) =>
      (await query<{result: string}>('select reserve_scan_score($1,$2,$3) as result', [job.id,job.lease,key]))[0].result
    const [first, second] = jobs
    assert.equal(await charge({ ...first, lease: randomUUID() }, 'bad lease'), 'skipped')
    assert.equal(await charge(first, 'score:first'), 'reserved')
    assert.equal(await charge(second, 'score:first'), 'duplicate')
    assert.equal(await charge(second, 'score:failed'), 'reserved')
    assert.equal(await charge(first, 'score:overflow'), 'limited')
    await db.query("select refund_usage($1,'score:failed')", [owner])
    assert.equal(await charge(second, 'score:replacement'), 'reserved')
    const post = { niche_id:niche, source:'hn', url:'https://news.ycombinator.com/item?id=232', title:'Hiring', body:'Design',
      author:'buyer', posted_at:new Date().toISOString(), intent_score:85, intent_reason:'Hiring', problem_summary:'Design' }
    await db.query("select finalize_scan_score($1,'score:first',$2::jsonb)", [owner,JSON.stringify(post)])
    await db.query("select finalize_scan_score($1,'score:first',$2::jsonb)", [owner,JSON.stringify(post)])
    await db.query("select finalize_scan_score($1,'score:replacement',null)", [owner])
    await db.query("update scan_jobs set candidates='[{},{}]'::jsonb,done_at=now(),lease=null where run_id=$1", [run])
    await db.query('delete from scan_jobs where run_id=$1', [run])
    assert.deepEqual(await query(`select sum(found)::int found,sum(scored)::int scored,sum(matched)::int matched,sum(spent)::int spent
      from scan_run_sources where run_id=$1`, [run]), [{ found:4,scored:2,matched:1,spent:2 }])
    assert.equal(await balance(owner), 3)
    assert.ok((await query<{ok:boolean}>("select reserve_usage($1,'reply:1','response',1) ok",[owner]))[0].ok)
    await db.query("update usage_events set settled_at=now() where user_id=$1 and request_key='reply:1'", [owner])
    await db.query('update profiles set credits=credits+3 where id=$1',[owner])
    const [{ id: next }] = await start(owner, randomUUID(), 10)
    // Balance 5, two of the three reserved reply credits remain.
    assert.equal((await query<{n:number}>('select scan_allowance($1) n',[next]))[0].n, 3)
    await db.query('select save_scan_budget($1,$2,3)',[owner,niche])
    const [{ run_id: scheduled }] = await query<{ run_id:string }>(
      "insert into scan_jobs(niche_id,source,scan_hour) values($1,'hn',date_trunc('hour',now())) returning run_id", [niche],
    )
    const [scheduledJob] = await query<{id:string;lease:string}>('select * from claim_run_scan_jobs($1,1)',[scheduled])
    assert.equal(await charge(scheduledJob,'score:paused'), 'skipped')
    await db.query('update niches set active=true where id=$1',[niche])
    assert.equal(await charge(scheduledJob,'score:scheduled'), 'reserved')
    assert.equal((await query<{n:number}>('select scan_allowance($1) n',[next]))[0].n, 0)
    await db.query("update usage_events set created_at=created_at-interval '1 month' where user_id=$1 and type='score'", [owner])
    assert.equal((await query<{n:number}>('select scan_allowance($1) n',[next]))[0].n, 2)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [stranger])
    await db.exec('set role authenticated')
    try {
      assert.deepEqual(await query('select * from scan_runs where id=$1', [run]), [])
      assert.deepEqual(await query('select * from scan_run_sources where run_id=$1', [run]), [])
      await assert.rejects(start(owner, randomUUID(), 5), /permission denied/i)
    } finally { await db.exec('reset role') }
  })

  it('settles local assessments once, refunds them, and permits later model review of nonmatches', async () => {
    const owner = await newUser(5)
    const [{ id: niche }] = await query<{ id: string }>(
      "insert into niches(user_id,skill,keywords,sources,active) values($1,'Software Engineer',array['developer'],array['hn'],false) returning id",
      [owner],
    )
    const run = randomUUID()
    await db.query('select start_manual_scan($1,$2,$3,2)', [owner, niche, run])
    const [job] = await query<{ id: string; lease: string }>('select * from claim_run_scan_jobs($1,1)', [run])
    const reservePost = async (key: string, id = job.id, lease = job.lease) =>
      (await query<{ state: string }>('select reserve_scan_score($1,$2,$3) as state', [id, lease, key]))[0].state
    const finalize = async (key: string, post: object | null, lease = job.lease) =>
      (await query<{ state: string }>('select finalize_local_score($1,$2,$3,$4) as state', [job.id, lease, key, post]))[0].state
    const post = {
      niche_id: niche, source: 'hn', url: 'https://news.ycombinator.com/item?id=123', author: 'buyer',
      posted_at: new Date().toISOString(), title: 'Hiring a developer', body: 'I need help with my app.',
      intent_score: 85, intent_reason: 'Explicit hiring request', problem_summary: 'App development',
    }
    assert.equal(await reservePost('match'), 'reserved')
    assert.equal(await balance(owner), 4)
    assert.equal(await finalize('match', post, randomUUID()), 'skipped')
    await assert.rejects(finalize('match', { ...post, source: 'forums' }), /source job/i)
    assert.equal(await balance(owner), 4)
    assert.equal(await finalize('match', post), 'matched')
    assert.equal(await finalize('match', post), 'skipped')
    assert.equal(await reservePost('match'), 'duplicate')
    assert.equal(await reservePost('irrelevant'), 'reserved')
    assert.equal(await finalize('irrelevant', null), 'unmatched')
    assert.equal(await reservePost('irrelevant'), 'duplicate')
    assert.equal(await balance(owner), 5)
    assert.deepEqual(await query('select score_method from leads where niche_id=$1', [niche]), [{ score_method: 'local' }])
    assert.deepEqual(await query('select scored,local_scored,matched,spent from scan_run_sources where run_id=$1', [run]),
      [{ scored: 2, local_scored: 2, matched: 1, spent: 0 }])
    assert.deepEqual(await query('select cost_credits,settled_at is not null as settled from usage_events where user_id=$1', [owner]),
      [{ cost_credits: 0, settled: true }, { cost_credits: 0, settled: true }])
    await db.query('update scan_jobs set done_at=now(),lease=null where id=$1', [job.id])
    const nextRun = randomUUID()
    await db.query('select start_manual_scan($1,$2,$3,2)', [owner,niche,nextRun])
    const [nextJob] = await query<{ id: string; lease: string }>('select * from claim_run_scan_jobs($1,1)', [nextRun])
    assert.equal(await reservePost('irrelevant', nextJob.id, nextJob.lease), 'reserved')
    assert.equal(await reservePost('match', nextJob.id, nextJob.lease), 'duplicate')
    await db.exec('set role authenticated')
    try {
      await assert.rejects(finalize('irrelevant', null), /permission denied/i)
    } finally { await db.exec('reset role') }
  })

  it('resumes stored candidates through a provider cooldown while protecting new source fetches', async () => {
    const owner = await newUser(5)
    const [{ id: niche }] = await query<{ id: string }>(
      "insert into niches(user_id,skill,keywords,sources) values($1,'Design',array['help'],array['reddit','forums']) returning id", [owner],
    )
    const run = randomUUID()
    await db.query('select start_manual_scan($1,$2,$3,5)', [owner,niche,run])
    await db.query("update scan_jobs set available_at=now(),candidates=case when source='reddit' then '[{}]'::jsonb end where run_id=$1", [run])
    await db.query("select defer_source('exa',now()+interval '15 minutes')")
    try {
      assert.deepEqual(await query('select source from claim_run_scan_jobs($1,8)', [run]), [{ source: 'reddit' }])
      await db.query("update scan_jobs set available_at=now(),lease=null where run_id=$1 and source='reddit'", [run])
      const global = await query<{source:string}>('select source from claim_scan_jobs(100) where run_id=$1', [run])
      assert.deepEqual(global, [{ source: 'reddit' }])
    } finally {
      await db.query("delete from source_backoffs where source='exa'")
    }
  })

  it('leaves completed pre-upgrade slots out of the receipt history', async () => {
    const owner=await newUser(3)
    const [niche]=await query<{id:string}>(
      "insert into niches(user_id,skill,keywords,sources) values($1,'Design',array['hiring'],array['hn']) returning id", [owner],
    )
    // A job completed before receipts shipped has a null run_id.
    await db.exec('alter table scan_jobs disable trigger user')
    try {
      await db.query(`insert into scan_jobs(niche_id,source,scan_hour,done_at)
        values($1,'hn',date_bin(interval '10 minutes',now(),'2000-01-01'::timestamptz),now())`,[niche.id])
    } finally { await db.exec('alter table scan_jobs enable trigger user') }
    await db.query('select enqueue_scans()')
    assert.deepEqual(await query('select id from scan_runs where niche_id=$1',[niche.id]),[])
  })
})
