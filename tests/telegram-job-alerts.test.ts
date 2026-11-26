import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

test('Telegram job watches require the linked chat, claim each due watch once and revoke stale subscriptions', async () => {
  const db = new PGlite()
  const user = randomUUID()
  const other = randomUUID()
  const watch = (owner: string, chat: string, query: string | null) =>
    db.query('select set_telegram_job_watch($1,$2,$3)', [owner, chat, query])
  const current = async () => (await db.query<{ id: string; query: string }>(
    'select id,query from telegram_job_watches where user_id=$1', [user],
  )).rows
  const claim = async (limit: number) => (await db.query<{ user_id: string; id: string }>(
    'select user_id,id from claim_telegram_job_watches($1)', [limit],
  )).rows
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;`)
    const dir = new URL('../supabase/migrations/', import.meta.url)
    for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name, dir), 'utf8'))
    }
    for (const id of [user, other]) {
      await db.query('insert into auth.users values($1,$2)', [id, id + '@example.org'])
    }

    await db.exec('set role service_role')
    await assert.rejects(watch(user, '42', 'shopify'), /not linked/)
    await db.query("update profiles set telegram_chat_id='42' where id=$1", [user])
    await db.query("update profiles set telegram_chat_id='76' where id=$1", [other])
    await assert.rejects(watch(user, '76', ''), /not linked/)
    await assert.rejects(watch(user, '42', 'x'), /check constraint/)
    await watch(user, '42', ' shopify ')
    const [first] = await current()
    assert.equal(first.query, 'shopify')
    assert.deepEqual(await claim(0), [])
    assert.deepEqual(await claim(1), [{ user_id: user, id: first.id }])
    await watch(user, '42', 'shopify')
    assert.deepEqual(await current(), [first])
    assert.deepEqual(await claim(100), [])
    await db.query("update telegram_job_watches set next_check_at=now()-interval '1 second' where user_id=$1", [user])
    assert.deepEqual(await claim(1), [{ user_id: user, id: first.id }])

    await watch(user, '42', '')
    const [changed] = await current()
    assert.notEqual(changed.id, first.id)
    assert.deepEqual(await claim(1), [{ user_id: user, id: changed.id }])
    await assert.rejects(watch(user, '76', null), /not linked/)
    await watch(user, '42', null)
    await watch(user, '42', null)
    assert.deepEqual(await current(), [])
    await watch(user, '42', 'design')
    await db.query("update profiles set telegram_chat_id='84' where id=$1", [user])
    assert.deepEqual(await current(), [])
    await assert.rejects(watch(user, '42', 'design'), /not linked/)
    await watch(user, '84', 'design')
    await db.query('update profiles set telegram_chat_id=null where id=$1', [user])
    assert.deepEqual(await current(), [])
    assert.deepEqual(await claim(1), [])

    await watch(other, '76', 'design')
    await db.exec('reset role')
    assert.deepEqual((await db.query("select relrowsecurity from pg_class where oid='telegram_job_watches'::regclass")).rows,
      [{ relrowsecurity: true }])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other])
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role)
      await assert.rejects(db.query('select * from telegram_job_watches'), /permission denied/)
      await assert.rejects(watch(other, '76', null), /permission denied/)
      await assert.rejects(claim(1), /permission denied/)
      await db.exec('reset role')
    }
    // Even a read grant alone cannot expose chat IDs, including to the account holder.
    await db.exec('grant select on telegram_job_watches to authenticated; set role authenticated')
    assert.deepEqual((await db.query('select chat_id from telegram_job_watches')).rows, [])
  } finally {
    await db.close()
  }
})

test('paid job alerts filter, deduplicate and recheck consent before Telegram delivery', async t => {
  // Resolve server-only imports the same way as the Next.js server.
  if (!process.execArgv.includes('--conditions=react-server')) {
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const { stdout } = await promisify(execFile)(process.execPath, ['--conditions=react-server', '--import=tsx', '--test',
      '--test-reporter=tap', '--test-name-pattern=^paid job alerts filter', fileURLToPath(import.meta.url)], { env })
    assert.match(stdout, /ok \d+ - paid job alerts filter/)
    return
  }
  const { queueTelegramJobAlerts, deliverTelegramJob } = await import('../lib/job-alerts')
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', TELEGRAM_BOT_TOKEN: 'test-token' }
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key]
    process.env[key] = value
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
  }
  const now = Date.now()
  const minutesAgo = (n: number) => new Date(now - n * 60_000).toISOString()
  const watch = { id: randomUUID(), user_id: randomUUID(), chat_id: '42', started_at: minutesAgo(5), query: 'Shopify' }
  type Notification = { kind: string; user_id: string; event_key: string; payload: { watch_id: string; posted_at: string; url: string } }
  const outbox = new Map<string, Notification>()
  const delivered: { chat_id: string; text: string }[] = []
  let subscribed = true
  let telegramStatus = 503
  function job(slug: string, age: number, details = 'Compensation is $60 per hour.') {
    return '<item><title>Acme: ' + slug + '</title><type>Contract</type><description>' + details + '</description>' +
      '<pubDate>' + new Date(minutesAgo(age)).toUTCString() + '</pubDate><link>https://weworkremotely.com/remote-jobs/' + slug + '</link></item>'
  }
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.host === 'weworkremotely.com') return new Response('<rss><channel><title>Jobs</title>' +
      job('shopify-contract', 1) + job('shopify-theme', 3, 'Build a new storefront theme.') +
      job('shopify-old', 10) + job('transcription', 2) + '</channel></rss>')
    if (url.host === 'api.github.com') return Response.json({ total_count: 0, incomplete_results: false, items: [] })
    if (url.host === 'remoteok.com' || url.host === 'mastodon.social') return Response.json([])
    if (url.host === 'api.telegram.org') {
      assert.equal(url.pathname, '/bottest-token/sendMessage')
      if (telegramStatus !== 200) return new Response(null, { status: telegramStatus })
      delivered.push(await request.json())
      return Response.json({ ok: true })
    }
    assert.equal(url.host, 'db.example.test')
    switch (url.pathname) {
      case '/rest/v1/rpc/claim_telegram_job_watches':
        return Response.json([watch])
      case '/rest/v1/source_backoffs':
        return Response.json([])
      case '/rest/v1/notifications': {
        assert.equal(url.searchParams.get('on_conflict'), 'event_key')
        assert.match(request.headers.get('prefer') ?? '', /resolution=ignore-duplicates/)
        const rows: Notification[] = await request.json()
        const previous = outbox.size
        for (const notice of rows) outbox.set(notice.event_key, notice)
        return new Response(null, { status: 201, headers: { 'Content-Range': '*/' + (outbox.size - previous) } })
      }
      case '/rest/v1/telegram_job_watches': {
        const matches = subscribed && url.searchParams.get('user_id') === 'eq.' + watch.user_id &&
          url.searchParams.get('chat_id') === 'eq.' + watch.chat_id && url.searchParams.get('id') === 'eq.' + watch.id
        return Response.json(matches ? [{ id: watch.id }] : [])
      }
      default: throw new Error('Unexpected request during alert test: ' + url.pathname)
    }
  })
  assert.deepEqual(await queueTelegramJobAlerts(), { checked: 1, queued: 2 })
  assert.deepEqual(await queueTelegramJobAlerts(), { checked: 1, queued: 0 })
  const [notice, unpriced] = outbox.values()
  assert.equal(notice.kind, 'telegram_job')
  assert.equal(notice.user_id, watch.user_id)
  assert.equal(notice.payload.url, 'https://weworkremotely.com/remote-jobs/shopify-contract')
  const send = () => deliverTelegramJob(watch.user_id, watch.chat_id, notice.payload)
  await assert.rejects(send(), /Telegram delivery failed/)
  telegramStatus = 200
  await send()
  assert.equal(delivered[0].chat_id, watch.chat_id)
  assert.match(delivered[0].text, /We Work Remotely/)
  assert.ok(delivered[0].text.includes(notice.payload.url))
  await deliverTelegramJob(watch.user_id, watch.chat_id, unpriced.payload)
  assert.match(delivered[1].text, /Contract · Pay not listed/)
  await deliverTelegramJob(watch.user_id, '99', notice.payload)
  await deliverTelegramJob(watch.user_id, null, notice.payload)
  await deliverTelegramJob(watch.user_id, watch.chat_id, { ...notice.payload, posted_at: minutesAgo(1441) })
  await deliverTelegramJob(watch.user_id, watch.chat_id, { ...notice.payload, posted_at: minutesAgo(-1) })
  await deliverTelegramJob(watch.user_id, watch.chat_id, { ...notice.payload, watch_id: randomUUID() })
  subscribed = false
  await send()
  assert.equal(delivered.length, 2)
})
