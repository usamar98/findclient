import Link from 'next/link'
import { requireUser } from '@/lib/db/server'
import { sources } from '@/lib/niche'
import { readScanReceipts, scanPending, scanTotals, sourceState } from '@/lib/scan-receipts'
import { BudgetForm, RefreshScanReceipts, ScanNowForm } from '@/components/workspace/scan-controls'
import './scans.css'

export const metadata = { title: 'Scans and credits | Lead To Client' }
export const maxDuration = 120
const time = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const states: Record<string, string> = {
  queued: 'Queued', running: 'Checking posts', complete: 'Complete', limited: 'Credit limit reached',
  skipped: 'Search paused or source removed', retrying: 'Waiting to retry', expired: 'Retry window ended',
  missing_exa: 'Exa search key missing', missing_scorer: 'OpenAI scoring key missing',
}

export default async function Scans() {
  const { db, user } = await requireUser()
  const [profile, saved, usage, runs] = await Promise.all([
    db.from('profiles').select('credits,monthly_reply_reserve').eq('id', user.id).single(),
    db.from('niches').select('id,skill,active,monthly_score_limit').eq('user_id', user.id).order('skill'),
    db.rpc('monthly_scan_usage'), readScanReceipts(user.id, 20),
  ])
  if (profile.error || saved.error || usage.error) return <><h1>Scans and credits</h1>
    <p>Scan controls are unavailable. Check the database connection and apply the latest workspace migrations.</p></>
  const replySpend = usage.data.filter(x => x.kind === 'response').reduce((sum, x) => sum + x.credits, 0)
  return <div className="cf-scans">
    <h1>Scans and credits</h1>
    <section className="panel"><h2>Scan now</h2>
      <p>{profile.data.credits} credits available. Scoring a post and creating an automatic reply each cost one credit.
        The scan cap covers both. When it is reached, matched leads stay in your inbox and any remaining automatic drafts are skipped.</p>
      {saved.data.length ? <ScanNowForm searches={saved.data} /> :
        <p>Create a saved search to choose the sources you want to scan. <Link href="/app/onboarding">Add a saved search</Link></p>}
    </section>
    <section className="panel"><h2>Monthly credit controls</h2>
      <p>Budgets reset on the first of each month at 00:00 UTC. They apply to manual and scheduled scoring.</p>
      <div className="scan-setting"><h3>Reserve for replies</h3>
        <p>{replySpend} reply credits used this month. Each reply counts toward the reserve.
          {' '}{Math.min(profile.data.credits, Math.max(0, profile.data.monthly_reply_reserve - replySpend))} credits are currently protected.</p>
        <BudgetForm amount={profile.data.monthly_reply_reserve} label="Monthly reply reserve" />
      </div>
      {saved.data.map(niche => <div className="scan-setting" key={niche.id}><h3>{niche.skill}</h3>
        <p>{usage.data.find(x => x.kind === 'score' && x.niche_id === niche.id)?.credits ?? 0} scoring credits used this month.
          Leave the limit blank for unrestricted scoring or set it to zero to pause scoring.</p>
        <BudgetForm niche={niche.id} amount={niche.monthly_score_limit} label="Monthly scoring limit" />
      </div>)}
    </section>
    <section className="panel"><h2>Scan receipts</h2>
      <RefreshScanReceipts active={runs.some(scanPending)} />
      {!runs.length && <p>Your first receipt appears when you start a scan or your next scheduled scan runs.</p>}
      {runs.map(run => {
        const total = scanTotals(run)
        return <details className="scan-receipt" key={run.id}>
          <summary><strong>{run.service}</strong> · {run.credit_limit === null ? 'Scheduled scan' : 'Manual scan'}
            <span>{time.format(new Date(run.started_at))} UTC{scanPending(run) ? ' · In progress' : ''}</span>
            <span>{total.found} found → {total.scored} scored → {total.matched} matched · {total.spent} credits used</span>
          </summary>
          {run.credit_limit !== null && <p>This scan used {total.spent} of its {run.credit_limit} allowed credits.</p>}
          {total.drafted > 0 && <p>{total.scored} scoring credits · {total.drafted} automatic reply credits</p>}
          {total.skipped > 0 && <p>{total.skipped} automatic {total.skipped === 1 ? 'draft was' : 'drafts were'} skipped at the credit cap.</p>}
          <div className="scan-source-list">{run.sources.map(source => <div key={source.job_id}>
            <strong>{sources[source.source as keyof typeof sources] ?? source.source}</strong>
            <p>{states[sourceState(run, source)] ?? source.state}{source.source_checked && ' · Source responded'}{sourceState(run, source) === 'retrying' && source.retry_at && ' · ' + time.format(new Date(source.retry_at)) + ' UTC'}</p>
            <span>{source.found} found · {source.scored} scored · {source.matched} matched
              {source.drafted > 0 && ` · ${source.drafted} automatic replies`} · {source.spent} credits</span>
            {source.draft_skipped > 0 && <p>{source.draft_skipped} automatic {source.draft_skipped === 1 ? 'draft' : 'drafts'} skipped at the cap</p>}
          </div>)}</div>
        </details>
      })}
    </section>
  </div>
}
