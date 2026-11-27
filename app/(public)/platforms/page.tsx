import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs, JsonLd, QuickAnswer } from '@/components/marketing/seo'
import {
  platformAccessAnswer, platformBrowseAnswer, platformFreshnessAnswer, platformGuideAnswer,
  platformGuideRows, platformGuideUpdated, platformRuntimeAnswer, platformTimingNote, platformWatchAnswer,
} from '@/lib/platform-guide'
import { isPaidSource } from '@/lib/paid-sources'
import { absolute, buildMetadata } from '@/lib/seo'
import './platforms.css'

const path = '/platforms'
const markdown = '/guides/platforms.md'
const title = 'Fresh freelance leads by platform: post age and rechecks | Lead To Client'
const description = `Compare freshness across ${platformGuideRows.length} freelance lead sources. See how the 15-minute post filter and optional 1-minute recheck work for job boards, bounties and communities.`
const baseMetadata = buildMetadata({ path, title, description })
export const metadata: Metadata = {
  ...baseMetadata,
  alternates: {
    ...baseMetadata.alternates,
    types: { ...baseMetadata.alternates?.types, 'text/markdown': absolute(markdown) },
  },
}

const paidRows = platformGuideRows.filter(row => isPaidSource(row.id))
const communityRows = platformGuideRows.filter(row => !isPaidSource(row.id))
const directory = [...paidRows, ...communityRows]
const updatedLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(platformGuideUpdated))

function SourceList({ rows }: { rows: typeof platformGuideRows }) {
  return <ul className="platform-directory">{rows.map(row => (
    <li key={row.id} id={row.id}>
      <h3>{row.name}</h3>
      <p>{row.detail}</p>
      <a href={row.url}>{row.reference}</a>
    </li>
  ))}</ul>
}

export default function Platforms() {
  return <main className="mk-article">
    <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Platforms', href: path }]} />
    <h1>Where to find fresh freelance leads and paid projects</h1>
    <QuickAnswer>{platformGuideAnswer}</QuickAnswer>
    <p className="mk-meta">Updated <time dateTime={platformGuideUpdated}>{updatedLabel}</time> · <a href={markdown}>Markdown edition</a></p>
    <nav aria-label="Platform guide sections" className="platform-jump-links">
      <a href="#freshness">15-minute filter</a>
      <a href="#one-minute-recheck">1-minute recheck</a>
      <a href="#source-freshness">Freshness by source</a>
      <a href="#paid-freelance-jobs">Paid freelance jobs</a>
      <a href="#community-sources">Community sources</a>
    </nav>
    <section aria-labelledby="freshness">
      <h2 id="freshness">What does the 15-minute filter show?</h2>
      <p>{platformFreshnessAnswer}</p>
      <p>For a check at 10:20 UTC, a post published at 10:13 is seven minutes old. A job posted at 10:04 and first found at 10:19 falls outside the 15-minute window. It can still appear in the 24-hour Jobs feed.</p>
      <p>Open <Link href="/app/jobs">24-hour Jobs</Link> to browse freelance openings. An employer contract can show “Pay not listed” when its source gives no rate. Community results in Live Research can also include people asking for advice.</p>
    </section>
    <section aria-labelledby="one-minute-recheck">
      <h2 id="one-minute-recheck">When does the 1-minute recheck run?</h2>
      <p>{platformWatchAnswer}</p>
      <p>Each recheck keeps your original time window. Jobicy’s three-hour publication delay puts its listings outside both recheck windows. Selecting Reddit, X or Indie Hackers makes rechecks manual. For ongoing inbox alerts, <Link href="/how-it-works#source-coverage">see the saved search schedule</Link>.</p>
    </section>
    <section aria-labelledby="source-freshness">
      <h2 id="source-freshness">How fresh is each freelance lead source?</h2>
      <p>{platformTimingNote}</p>
      <table className="platform-freshness-table" aria-labelledby="source-freshness">
        <thead><tr><th scope="col">Source</th><th scope="col">How we check it and measure post age</th></tr></thead>
        <tbody>{directory.map(row => (
          <tr key={row.id}>
            <th scope="row"><a href={'#' + row.id}>{row.name}</a></th>
            <td>{row.freshness}</td>
          </tr>
        ))}</tbody>
      </table>
      <h3>How can I verify the age of an individual lead?</h3>
      <p>{platformRuntimeAnswer} Open <strong>Platform coverage</strong> to see which sources responded. Follow a result’s original link to confirm its timestamp and whether the work is still available.</p>
    </section>
    <section aria-labelledby="paid-freelance-jobs">
      <h2 id="paid-freelance-jobs">Which platforms list paid freelance work?</h2>
      <p>{platformBrowseAnswer}</p>
      <SourceList rows={paidRows} />
      <Link className="mk-btn" href="/app/jobs">Browse 24-hour jobs</Link>
    </section>
    <section aria-labelledby="community-sources">
      <h2 id="community-sources">Where do people ask for help?</h2>
      <p>Search these {communityRows.length} sources for the work you do. Live Research groups hiring requests, requests for help and related discussions so you can decide which conversations to join.</p>
      <SourceList rows={communityRows} />
    </section>
    <section>
      <h2>Which sources work without an API key?</h2>
      <p>{platformAccessAnswer}</p>
    </section>
    <p><Link href="/faq#source-freshness">Read the fresh lead search FAQ</Link></p>
    <JsonLd data={{
      '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': absolute(path + '#page'),
      url: absolute(path), name: 'Where to find fresh freelance leads and paid projects', description,
      inLanguage: 'en', dateModified: platformGuideUpdated, isPartOf: { '@id': absolute('/#website') },
      about: { '@id': absolute('/#app') }, publisher: { '@id': absolute('/#organization') },
      mainEntity: {
        '@type': 'ItemList', name: 'Lead To Client Live Research sources', numberOfItems: directory.length,
        itemListElement: directory.map((row, index) => ({
          '@type': 'ListItem', position: index + 1, name: row.name, url: absolute(path + '#' + row.id),
          description: row.freshness,
        })),
      },
    }} />
  </main>
}
