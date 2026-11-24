import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { it } from 'node:test'
import { defaultProposal, formatPrice } from '../lib/proposals/model'
import { parseProposalForm } from '../lib/proposals/form'
import { proposalDownload } from '../lib/proposals/pdf'

const proposal = defaultProposal({ title: 'Checkout redesign', author: 'Store team', problem_summary: 'Simplify the mobile checkout.' }, 'Studio')

it('renders a branded PDF and preserves amounts and unspecified prices', async () => {
  const form = new FormData()
  for (const [key, value] of Object.entries({
    brand: 'Studio', recipient: 'Store team', title: 'Checkout', scope: 'Improve the mobile checkout', currency: 'USD', contact: '',
    count: '2', name0: 'Discovery', price0: '149.99', details0: 'Review the flow', timeline0: 'Three days',
    name1: 'Implementation', price1: '', details1: 'Apply the findings', timeline1: 'After discovery',
  })) form.set(key, value)
  const document = parseProposalForm(form)
  assert.ok(document.success)
  assert.equal(formatPrice(document.data.packages[0].priceCents, 'USD').replace(/\s/g, ' '), 'USD 149.99')
  assert.equal(formatPrice(document.data.packages[1].priceCents, 'USD'), 'Quote after scoping')
  const download = await proposalDownload(document.data)
  assert.equal(download.headers.get('Content-Type'), 'application/pdf')
  const bytes = Buffer.from(await download.arrayBuffer())
  assert.ok(bytes.toString('ascii', 0, 5) === '%PDF-' && bytes.includes(Buffer.from('%%EOF')))
  form.set('price0', '-1')
  assert.equal(parseProposalForm(form).success, false)
})

it('isolates drafts by lead, publishes snapshots, rejects stale edits and deduplicates share visits', async () => {
  const db = new PGlite()
  const owner = randomUUID(), outsider = randomUUID(), lead = randomUUID()
  const migration = new URL('../supabase/migrations/20261124065955_lead_proposals.sql', import.meta.url)
  async function asUser(id: string) {
    await db.exec('reset role')
    await db.query("select set_config('test.viewer', $1, false)", [id])
    await db.exec('set role authenticated')
  }
  const save = async (action: string, revision: number, title = 'Checkout redesign') =>
    (await db.query<{ updated: boolean }>('select save_lead_proposal($1,$2,$3,$4) as updated',
      [lead, JSON.stringify({ ...proposal, title }), action, revision])).rows[0].updated
  const snapshot = async () => (await db.query<{
    share_token: string | null; draft: string; public_title: string | null; open_count: number
  }>("select share_token,document->>'title' draft,published_document->>'title' public_title,open_count from lead_proposals")).rows[0]
  try {
    await db.exec(`
      create role authenticated; create role anon; create role service_role bypassrls; create schema private;
      create table public.leads(id uuid primary key, owner_id uuid not null);
      alter table public.leads enable row level security;
      grant select on public.leads to authenticated;
      create policy read_team_leads on public.leads for select to authenticated using(owner_id = current_setting('test.viewer')::uuid);
    `)
    await db.query('insert into leads values ($1,$2)', [lead, owner])
    await db.exec(await readFile(migration, 'utf8'))
    await asUser(owner)
    assert.equal(await save('save', 0), true)
    assert.equal((await snapshot()).share_token, null)
    assert.equal(await save('publish', 1), true)
    const token = (await snapshot()).share_token
    assert.ok(token)
    assert.equal(await save('save', 2, 'Updated scope'), true)
    assert.equal(await save('publish', 2, 'Stale scope'), false)
    assert.deepEqual(await snapshot(), { share_token: token, draft: 'Updated scope', public_title: 'Checkout redesign', open_count: 0 })
    await asUser(outsider)
    assert.equal(await snapshot(), undefined)
    await assert.rejects(save('publish', 3), /lead unavailable/i)
    await assert.rejects(db.query('select record_proposal_open($1,$2)', [token, randomUUID()]), /permission denied/i)
    await db.exec('reset role; set role anon')
    await assert.rejects(db.query('select * from lead_proposals'), /permission denied/i)
    await db.exec('reset role; set role service_role')
    const visit = randomUUID()
    const record = (link: string, visitor = visit) => db.query('select record_proposal_open($1,$2)', [link, visitor])
    await record(token)
    await record(token)
    assert.equal((await snapshot()).open_count, 1)
    await asUser(owner)
    assert.equal(await save('rotate', 3), true)
    const replacement = (await snapshot()).share_token!
    assert.notEqual(replacement, token)
    await db.exec('reset role; set role service_role')
    await record(token, randomUUID())
    assert.equal((await snapshot()).open_count, 1)
    await record(replacement, randomUUID())
    assert.equal((await snapshot()).open_count, 2)
    await asUser(owner)
    assert.equal(await save('revoke', 4), true)
    assert.equal((await snapshot()).share_token, null)
    assert.equal((await snapshot()).public_title, null)
  } finally {
    await db.close()
  }
})
