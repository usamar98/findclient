import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { OWNER_PAGE_SIZE, type OwnerReport } from '../lib/owner-model'

test('owner analytics enforce service access and report signups, settled payments, cities and scan outcomes', async () => {
  const db = new PGlite()
  const buyer = randomUUID(), topupBuyer = randomUUID()
  const report = async (days = 7, search = '', users = 1, purchases = 1) => {
    const result = await db.query<{ report: OwnerReport }>(
      'select public.owner_report($1,$2,$3,$4) as report', [days, search, users, purchases],
    )
    return result.rows[0].report
  }
  const record = (receipt: string, city: string | null, country: string | null) =>
    db.query('select public.record_purchase_location($1,$2,$3)', [receipt, city, country])
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users (
        id uuid primary key, email text, created_at timestamptz not null default now(),
        last_sign_in_at timestamptz, deleted_at timestamptz
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
    `)
    const dir = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, dir), 'utf8'))
    }
    // The report correctly reads Auth through its fixed projection even when the
    // service role has no permission to query the auth schema itself.
    await db.exec('set role service_role')
    await assert.rejects(db.query('select email from auth.users'), /permission denied/)
    const empty = await report()
    assert.deepEqual(empty.summary, { signups: 0, activated: 0, buyers: 0, grossCents: 0 })
    assert.deepEqual(empty.users, { total: 0, rows: [] })
    assert.deepEqual(empty.cities, [])
    await db.exec('reset role')

    await db.query(`insert into auth.users(id,email,last_sign_in_at) values
      ($1,'Buyer@Example.org',now()), ($2,'credits@example.org',null)`, [buyer, topupBuyer])
    await db.exec(`
      insert into auth.users(id,email,created_at) select gen_random_uuid(), 'older' || i || '@example.org',
        now() - interval '21 days' from generate_series(1,21) i;
      insert into auth.users(id,email,deleted_at) values(gen_random_uuid(),'deleted@example.org',now());
    `)
    await db.query("update public.profiles set plan='lifetime' where id=$1", [buyer])
    await db.query(`insert into public.leads(user_id,source,url,title,posted_at,intent_reason,score_method)
      values ($1,'hn','https://example.org/job','Contract',now(),'Saved from research','manual')`, [buyer])
    await db.query(`insert into public.purchases(user_id,stripe_session_id,product,amount) values
      ($1,'cs_lifetime','lifetime',14900), ($1,'in_test','monthly',4900), ($2,'cs_topup','topup9',900)`,
    [buyer,topupBuyer])
    await db.query(`insert into public.purchases(user_id,stripe_session_id,product,amount,created_at)
      select $1, 'cs_old_' || i, 'topup9', 900, now()- interval '21 days' from generate_series(1,21) i`, [topupBuyer])
    const niche = randomUUID(), run = randomUUID()
    await db.query(`insert into public.niches(id,user_id,skill,keywords,sources)
      values($1,$2,'Design','{design}','{hn}')`, [niche,buyer])
    await db.query(`insert into public.scan_runs(id,user_id,niche_id,service,credit_limit)
      values($1,$2,$3,'Design',5)`, [run,buyer,niche])
    await db.query(`insert into public.scan_run_sources(job_id,run_id,source,state,found,scored,matched)
      values(gen_random_uuid(),$1,'hn','complete',9,6,3),(gen_random_uuid(),$1,'bluesky','failed_source',0,0,0)`, [run])

    for (const role of ['authenticated', 'anon']) {
      await db.exec('set role ' + role)
      await assert.rejects(report(), /permission denied/)
      await assert.rejects(db.query("select private.owner_report(7,'',1,1)"), /permission denied/)
      await assert.rejects(db.query('select * from public.purchase_billing_locations'), /permission denied/)
      await assert.rejects(record('cs_lifetime', 'Paris', 'FR'), /permission denied/)
      await db.exec('reset role')
    }

    await db.exec('set role service_role')
    await record('cs_lifetime', null, 'fr')
    await record('cs_lifetime', 'Lyon', 'US') // Conflicting country cannot supply the missing city.
    assert.equal((await report()).purchases.rows.find(x => x.product === 'lifetime')?.city, null)
    await record('cs_lifetime', ' Paris ', 'FR')
    await record('cs_lifetime', null, null)
    await record('cs_lifetime', 'Berlin', 'DE')
    await record('in_test', 'Paris', 'FR')
    await assert.rejects(record('cs_no_settled_purchase', 'Paris', 'FR'), /foreign key/)

    const result = await report()
    assert.deepEqual(result.summary, { signups: 2, activated: 1, buyers: 1, grossCents: 20700 })
    assert.equal(result.users.total, 23)
    assert.equal(result.purchases.total, 24)
    assert.equal(result.users.rows.length, OWNER_PAGE_SIZE)
    assert.equal(result.purchases.rows.length, OWNER_PAGE_SIZE)
    assert.deepEqual(result.cities, [
      { city: 'Paris', country: 'FR', purchases: 2 },
      { city: null, country: null, purchases: 1 },
    ])
    assert.deepEqual(result.sources, [
      { source: 'hn', found: 9, scored: 6, matched: 3, failed: 0 },
      { source: 'bluesky', found: 0, scored: 0, matched: 0, failed: 1 },
    ])
    const page2 = await report(7, '', 2, 2)
    assert.equal(new Set([...result.users.rows, ...page2.users.rows].map(u => u.id)).size, 23)
    assert.equal(new Set([...result.purchases.rows, ...page2.purchases.rows].map(p => p.id)).size, 24)
    const buyerOnly = await report(7, 'BUYER@')
    assert.equal(buyerOnly.users.total, 1)
    assert.equal(buyerOnly.users.rows[0].hasLead, true)
    assert.equal(buyerOnly.users.rows[0].plan, 'lifetime')
    assert.equal(buyerOnly.purchases.total, 2)
    assert.deepEqual(buyerOnly.summary, result.summary)
    assert.equal((await report(7, buyer)).purchases.total, 2)
    assert.equal((await report(7, '%')).users.total, 0)
    assert.equal((await report(30)).summary.signups, 23)
    assert.equal((await report(30)).summary.grossCents, 39600)
  } finally {
    await db.close()
  }
})
