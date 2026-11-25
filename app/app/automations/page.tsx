import { requireUser } from '@/lib/db/server'
import { missingDatabaseResource } from '@/lib/db/missing-resource'
import Link from 'next/link'
import { getWorkspacePeople } from '@/lib/workspace-access'
import { sources } from '@/lib/niche'
import { removeRule } from './actions'
import { RuleForm, SequenceForm } from './forms'
import './workflows.css'

export const metadata = { title: 'Automations | Lead To Client' }

export default async function AutomationsPage() {
  const { db, user } = await requireUser()
  const [rules, niches, members, settings, profile] = await Promise.all([
    db.from('lead_rules').select('*').eq('user_id',user.id).order('created_at'),
    db.from('niches').select('id,skill').eq('user_id',user.id).order('skill'),
    getWorkspacePeople(user.id),
    db.from('proposal_workflow_settings').select('enabled,delay_days').eq('user_id',user.id).maybeSingle(),
    db.from('profiles').select('telegram_chat_id').eq('id',user.id).single(),
  ])
  if (niches.error || profile.error
    || (rules.error && !missingDatabaseResource(rules.error, 'table', 'lead_rules'))
    || (settings.error && !missingDatabaseResource(settings.error, 'table', 'proposal_workflow_settings'))) {
    throw new Error('Unable to load automations.')
  }
  if (rules.error || settings.error) return <section>
    <h1>Automations</h1>
    <p>Apply the workspace automations migration in Supabase to enable lead rules and proposal follow-ups.</p>
    <Link href="/app/inbox">Open the lead inbox</Link>
  </section>
  const searches = niches.data.map(n => ({ id: n.id, name: n.skill }))
  const fields = { searches, people: members, telegram: Boolean(profile.data.telegram_chat_id) }
  return <div className="workflow-page">
    <h1>Automations</h1>
    <section className="panel"><h2>Lead rules</h2>
      <p>Choose which new leads to assign, draft a reply for, or send to Telegram.</p>
      {rules.data.map(rule => <details key={rule.id} className="workflow-rule">
        <summary><strong>{rule.name}</strong><span>{rule.enabled ? 'Active' : 'Paused'} · {rule.source ? sources[rule.source as keyof typeof sources] : 'All platforms'} · {rule.min_score}+ intent</span></summary>
        <RuleForm rule={rule} {...fields} />
        <form action={removeRule}><input type="hidden" name="id" value={rule.id} /><button className="workflow-remove">Remove rule</button></form>
      </details>)}
      <details className="workflow-rule" open={rules.data.length === 0}><summary><strong>Create a rule</strong></summary>
        <RuleForm {...fields} />
      </details>
      {rules.data.length > 1 && <p className="meta">Matching rules share one draft and one Telegram alert per lead. The earliest matching assignment takes priority.</p>}
    </section>
    <section className="panel"><h2>Proposal follow-up</h2>
      <SequenceForm enabled={settings.data?.enabled ?? true} days={settings.data?.delay_days ?? 3} />
    </section>
  </div>
}
