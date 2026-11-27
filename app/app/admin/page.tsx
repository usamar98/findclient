import Link from 'next/link'
import { planLabels } from '@/lib/offers'
import { OWNER_PAGE_SIZE } from '@/lib/owner-model'
import { getOwnerReport } from '@/lib/owner-report'
import { researchSourceLabels, type ResearchSourceId } from '@/lib/research-catalog'
import './admin.css'

export const metadata = { title: 'Owner dashboard | Lead To Client', referrer: 'no-referrer' } as const

const number = new Intl.NumberFormat('en-US')
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const utc = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const productLabels: Record<string, string> = {
  ...planLabels,
  topup9: 'Credit pack · $9',
  topup19: 'Credit pack · $19',
  topup29: 'Credit pack · $29',
}
type Filters = Awaited<ReturnType<typeof getOwnerReport>>['filters']

function reportHref(filters: Filters, changes: Partial<Filters>, section?: string) {
  const { days, search, userPage, purchasePage } = { ...filters, ...changes }
  const query = new URLSearchParams({ days: String(days) })
  if (search) query.set('q', search)
  if (userPage > 1) query.set('users', String(userPage))
  if (purchasePage > 1) query.set('purchases', String(purchasePage))
  return `/app/admin?${query}${section ? '#' + section : ''}`
}

function Timestamp({ value }: { value: string }) {
  return <time dateTime={value}>{utc.format(new Date(value))}</time>
}

function BillingCity({ city, country }: { city: string | null; country: string | null }) {
  return <>{city || 'City unavailable'}{country && <span className="owner-country"> · {country}</span>}</>
}

function Pagination({ filters, directory, total }: {
  filters: Filters
  directory: 'signups' | 'purchases'
  total: number
}) {
  const param = directory === 'signups' ? 'userPage' : 'purchasePage'
  const page = filters[param]
  const pages = Math.max(1, Math.ceil(total / OWNER_PAGE_SIZE))
  if (pages === 1 && page === 1) return null
  return <nav className="owner-pagination" aria-label={`${directory} pages`}>
    {page <= pages && <span>Page {number.format(page)} of {number.format(pages)}</span>}
    {page > 1 && <Link prefetch={false} href={reportHref(filters, { [param]: page > pages ? 1 : page - 1 }, directory)}>
      {page > pages ? 'First page' : 'Previous'}
    </Link>}
    {page < pages && <Link prefetch={false} href={reportHref(filters, { [param]: page + 1 }, directory)}>Next</Link>}
  </nav>
}

export default async function OwnerDashboard({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { report, filters } = await getOwnerReport(await searchParams)
  if (!report) return <section className="owner-report">
    <h1>Owner dashboard</h1>
    <p>To load your reports, run <code>20261127175139_owner_dashboard.sql</code> in your Lead To Client Supabase SQL Editor, then refresh this page.</p>
  </section>
  const { summary, cities, sources, users, purchases } = report
  const activation = summary.signups ? Math.round(100 * summary.activated / summary.signups) : null

  return <div className="owner-report">
    <div className="owner-title-bar">
      <div>
        <h1>Owner dashboard</h1>
        <nav className="owner-jumps" aria-label="Dashboard sections">
          <a href="#signups">Signups</a><a href="#purchases">Purchases</a><a href="#source-activity">Scan activity</a>
        </nav>
      </div>
      <nav className="owner-period" aria-label="Overview period">
        {[7, 30, 90].map(days => <Link key={days} prefetch={false} href={reportHref(filters, { days })}
          aria-current={days === filters.days ? 'page' : undefined}>{days} days</Link>)}
      </nav>
    </div>

    <dl className="owner-metrics" aria-label={`Product activity over the last ${filters.days} days`}>
      <div><dt>New signups</dt><dd>{number.format(summary.signups)}</dd><dd className="owner-detail">Accounts created in the last {filters.days} days.</dd></div>
      <div><dt>Reached their first lead</dt><dd>{number.format(summary.activated)}</dd><dd className="owner-detail">{activation === null ? 'No new signups in this period.' : `${activation}% of these new accounts have a lead in their inbox.`}</dd></div>
      <div><dt>Plan buyers</dt><dd>{number.format(summary.buyers)}</dd><dd className="owner-detail">Distinct customers who paid for a plan in this period, including renewals.</dd></div>
      <div><dt>Gross payments</dt><dd>{usd.format(summary.grossCents / 100)}</dd><dd className="owner-detail">Plans and credit packs in USD, before refunds and fees.</dd></div>
    </dl>

    <div className="owner-insights">
      <section id="source-activity" className="owner-card" aria-labelledby="activity-title">
        <div className="owner-heading"><h2 id="activity-title">Scan activity by source</h2><p>Post counts from saved-search scans in the last {filters.days} days.</p></div>
        {sources.length > 0 ? <div className="owner-scroll" role="region" aria-labelledby="activity-title" tabIndex={0}>
          <table className="owner-table owner-source-table">
            <thead><tr><th scope="col">Source</th><th scope="col">Found</th><th scope="col">Scored</th><th scope="col">Matched</th><th scope="col">Failed runs</th></tr></thead>
            <tbody>{sources.map(row => <tr key={row.source}><th scope="row">{researchSourceLabels[row.source as ResearchSourceId] ?? row.source}</th>
              <td>{number.format(row.found)}</td><td>{number.format(row.scored)}</td><td>{number.format(row.matched)}</td><td>{number.format(row.failed)}</td></tr>)}</tbody>
          </table>
        </div> : <p className="owner-empty">No source activity was recorded in this period.</p>}
      </section>
      <section className="owner-card" aria-labelledby="city-title">
        <div className="owner-heading"><h2 id="city-title">Purchases by billing city</h2><p>Top 10 locations by payment count in the last {filters.days} days, using Stripe billing addresses.</p></div>
        {cities.length > 0 ? <ul className="owner-city-list">{cities.map(row => <li key={JSON.stringify([row.city, row.country])}>
          <span><BillingCity city={row.city} country={row.country} /></span><strong>{number.format(row.purchases)}<span className="sr-only"> purchases</span></strong>
        </li>)}</ul> : <p className="owner-empty">No purchases were recorded in this period.</p>}
      </section>
    </div>

    <section id="directory" className="owner-directory" aria-labelledby="records-title">
      <div className="owner-directory-heading"><h2 id="records-title">Customer records</h2><p>Search all signups and purchases by email or exact account ID. Times are shown in UTC.</p></div>
      <form className="owner-search" action="/app/admin#directory" method="get" role="search" aria-label="Search customer records">
        <input type="hidden" name="days" value={filters.days} />
        <label htmlFor="owner-search">Email or account ID</label>
        <div><input key={filters.search} type="search" id="owner-search" name="q" defaultValue={filters.search} maxLength={254} placeholder="Search customer records" autoComplete="off" />
          <button type="submit">Search</button>
          {filters.search && <Link prefetch={false} href={reportHref(filters, { search: '', userPage: 1, purchasePage: 1 }, 'directory')}>Clear</Link>}
        </div>
      </form>

      <section id="signups" className="owner-card" aria-labelledby="signups-title">
        <div className="owner-heading owner-table-heading"><h3 id="signups-title">Signups</h3><span>{number.format(users.total)} {users.total === 1 ? 'account' : 'accounts'}</span></div>
        {users.rows.length > 0 ? <div className="owner-scroll" role="region" aria-labelledby="signups-title" tabIndex={0}>
          <table className="owner-table owner-records-table"><thead><tr><th scope="col">Customer</th><th scope="col">Signed up</th><th scope="col">Last sign-in</th><th scope="col">Current plan</th><th scope="col">Lead in inbox</th></tr></thead>
            <tbody>{users.rows.map(user => <tr key={user.id}><th scope="row"><span className="owner-email">{user.email || 'Email unavailable'}</span><small>{user.id}</small></th>
              <td><Timestamp value={user.createdAt} /></td><td>{user.lastSignInAt ? <Timestamp value={user.lastSignInAt} /> : 'No sign-in recorded'}</td>
              <td>{user.plan ? productLabels[user.plan] ?? user.plan : 'Unknown'}</td><td>{user.hasLead ? 'Yes' : 'No'}</td></tr>)}</tbody>
          </table>
        </div> : <p className="owner-empty">{users.total ? 'No accounts on this page.' : filters.search ? 'No accounts match this search.' : 'No signups yet.'}</p>}
        <Pagination directory="signups" filters={filters} total={users.total} />
      </section>

      <section id="purchases" className="owner-card" aria-labelledby="purchases-title">
        <div className="owner-heading owner-table-heading"><h3 id="purchases-title">Purchases</h3><span>{number.format(purchases.total)} {purchases.total === 1 ? 'payment' : 'payments'}</span></div>
        {purchases.rows.length > 0 ? <div className="owner-scroll" role="region" aria-labelledby="purchases-title" tabIndex={0}>
          <table className="owner-table owner-records-table"><thead><tr><th scope="col">Customer / purchase ID</th><th scope="col">Recorded at</th><th scope="col">Product</th><th scope="col">Amount</th><th scope="col">Billing city</th></tr></thead>
            <tbody>{purchases.rows.map(purchase => <tr key={purchase.id}><th scope="row"><span className="owner-email">{purchase.email || 'Email unavailable'}</span><small>{purchase.id}</small></th>
              <td><Timestamp value={purchase.createdAt} /></td><td>{productLabels[purchase.product] ?? purchase.product}</td><td>{usd.format(purchase.amountCents / 100)}</td>
              <td><BillingCity city={purchase.city} country={purchase.country} /></td></tr>)}</tbody>
          </table>
        </div> : <p className="owner-empty">{purchases.total ? 'No payments on this page.' : filters.search ? 'No payments match this search.' : 'No purchases have been recorded.'}</p>}
        <Pagination directory="purchases" filters={filters} total={purchases.total} />
      </section>
    </section>
  </div>
}
