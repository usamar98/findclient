import {
  assessBuyer,
  buyerSchema,
  feedbackLabels,
  requestLabels,
} from '@/lib/lead-intelligence'
import { saveMatchFeedback } from '@/app/app/settings/alert-actions'
import './lead-intelligence.css'

type Lead = {
  id: string
  title: string
  body: string
  url: string
  posted_at: string
  created_at: string
  intent_reason: string
  intent_score: number | null
  buyer_intelligence: unknown
  match_feedback: string | null
}
const displayTime = (iso: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso)) + ' UTC'

export function LeadIntelligence({ lead }: { lead: Lead }) {
  if (lead.intent_score === null) return null
  const stored = buyerSchema.safeParse(lead.buyer_intelligence)
  const info = stored.success ? stored.data : assessBuyer(lead)
  const days = info.account_created_at
    ? Math.floor(
        (Date.parse(lead.posted_at) - Date.parse(info.account_created_at)) /
          86400000,
      )
    : null
  const elapsed = Math.max(
    0,
    Math.round(
      (Date.parse(lead.created_at) - Date.parse(lead.posted_at)) / 60000,
    ),
  )
  const lag =
    elapsed < 60
      ? elapsed + ' min'
      : (elapsed / 60).toFixed(1).replace(/\.0$/, '') + ' hr'
  return (
    <section className="panel cf-lead-intelligence">
      <h2>Is this lead worth a reply?</h2>
      <div className="cf-lead-scores">
        <div>
          <span>Intent match</span>
          <strong>
            {lead.intent_score}
            <small>/100</small>
          </strong>
        </div>
        <div>
          <span>Buyer quality</span>
          <strong>
            {info.quality_score ?? 'Unknown'}
            {info.quality_score !== null && <small>/100</small>}
          </strong>
        </div>
      </div>
      <p>
        <b>{requestLabels[info.request_type]}</b> · {lead.intent_reason}
      </p>
      {info.evidence.request && (
        <blockquote>“{info.evidence.request}”</blockquote>
      )}
      <dl className="cf-lead-signals">
        <dt>Budget</dt>
        <dd>{info.evidence.budget || 'No budget stated'}</dd>
        <dt>Urgency</dt>
        <dd>{info.evidence.urgency || 'No deadline stated'}</dd>
        <dt>Business or store</dt>
        <dd>
          {info.evidence.business ||
            (info.site ? (info.site_source === 'profile' ? 'Website listed on the author’s public profile' : 'Linked in the original request') : 'Unknown')}
        </dd>
        <dt>Account age at posting</dt>
        <dd>
          {days === null ? 'Unknown' : days + (days === 1 ? ' day' : ' days')}
        </dd>
        <dt>Discovered</dt>
        <dd>
          <time dateTime={lead.created_at}>{displayTime(lead.created_at)}</time>{' '}
          · {lag} after posting
        </dd>
        <dt>Post availability</dt>
        <dd>
          {info.availability.state === 'closed'
            ? 'Closed or removed'
            : info.availability.state === 'visible'
              ? 'Public at last check'
              : 'Unverified'}
          {stored.success && info.availability.state !== 'unknown' && (
            <> · {displayTime(info.availability.checked_at)}</>
          )}
        </dd>
      </dl>
      <details>
        <summary>How buyer quality is calculated</summary>
        <p>
          Visible hiring intent contributes up to 30 points, budget 25, an
          existing business 20, urgency 15, and verified account age 10. Missing
          signals earn no points. Review the original post before replying.
        </p>
      </details>
      <form action={saveMatchFeedback}>
        <input type="hidden" name="lead" value={lead.id} />
        <label>
          Use this match to improve this search
          <select name="feedback" defaultValue={lead.match_feedback ?? 'clear'}>
            <option value="clear">No feedback</option>
            {Object.entries(feedbackLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button>Save match feedback</button>
      </form>
    </section>
  )
}
