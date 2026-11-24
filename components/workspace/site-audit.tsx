'use client'
import { useState, useTransition } from 'react'
import type { LeadAudit } from '@/lib/db/schema'
import { checkLeadSite } from '@/app/app/leads/audit-actions'

export function SiteAudit({
  id,
  audit,
  suggested,
}: {
  id: string
  audit: LeadAudit | null
  suggested: string | null
}) {
  const [message, setMessage] = useState(''),
    [busy, start] = useTransition()
  const report = audit?.status === 'complete' ? audit.report : null
  return (
    <section className="panel">
      <h2>Website audit</h2>
      {report ? (
        <>
          <p>
            <a href={report.url} target="_blank" rel="noopener noreferrer">
              {new URL(report.url).hostname}
            </a>{' '}
            · Checked {report.checkedAt.slice(0, 10)}
          </p>
          <p>
            Response headers in {report.responseMs} ms ·{' '}
            {Math.round(report.htmlBytes / 1024)} KiB of HTML
          </p>
          {report.mobile && (
            <dl
              className="cf-audit-metrics"
              aria-label="Mobile Lighthouse lab results"
            >
              {Object.entries({
                'Mobile performance':
                  report.mobile.performance === undefined
                    ? undefined
                    : report.mobile.performance + '/100',
                'Mobile SEO':
                  report.mobile.seo === undefined
                    ? undefined
                    : report.mobile.seo + '/100',
                'Mobile accessibility':
                  report.mobile.accessibility === undefined
                    ? undefined
                    : report.mobile.accessibility + '/100',
                'Largest contentful paint':
                  report.mobile.lcpMs === undefined
                    ? undefined
                    : (report.mobile.lcpMs / 1000).toFixed(1) + ' s',
                'Layout shift': report.mobile.cls?.toFixed(3),
              }).map(
                ([label, value]) =>
                  value !== undefined && (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ),
              )}
            </dl>
          )}
          {report.findings.length ? (
            <ul>
              {report.findings.map((f) => (
                <li key={f.category}>
                  <strong>{f.category}</strong> · {f.evidence}{' '}
                  {f.recommendation}
                </li>
              ))}
            </ul>
          ) : (
            <p>The HTML checks found no issues to use in a pitch.</p>
          )}
          <p className="meta">
            {report.mobile
              ? 'Includes a mobile Lighthouse lab run.'
              : 'Checks server response, search metadata and mobile layout markup.'}{' '}
            New reply drafts include the observed issues.
          </p>
        </>
      ) : (
        <p>
          {audit?.failure ||
            (suggested || audit?.target_url
              ? 'Website check pending.'
              : 'No business website was identified in this post. Add the site if the buyer shared it elsewhere.')}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const input = String(
            new FormData(event.currentTarget).get('site') || '',
          )
          start(async () => {
            try {
              setMessage(await checkLeadSite(id, input))
            } catch {
              setMessage('Could not check this site. Please try again.')
            }
          })
        }}
      >
        <label>
          Buyer’s website
          <input
            name="site"
            defaultValue={audit?.target_url || suggested || ''}
            required
            maxLength={1500}
            placeholder="https://store.example.com"
          />
        </label>
        <button disabled={busy}>
          {busy ? 'Checking website…' : 'Check website'}
        </button>
        <span role="status">{message}</span>
      </form>
    </section>
  )
}
