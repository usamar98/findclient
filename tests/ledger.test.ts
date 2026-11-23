import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'

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

describe('Clientfind Postgres ledger', { concurrency: false }, () => {
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
    assert.equal(
      new Date(deadline.ends).toISOString(),
      '2026-12-26T19:00:00.000Z',
    )
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
})
