import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs, JsonLd, QuickAnswer } from '@/components/marketing/seo'
import {
  platformAccessAnswer, platformBrowseAnswer, platformFreshnessAnswer, platformGuideAnswer,
  platformGuideRows, platformGuideUpdated, platformRuntimeAnswer, platformWatchAnswer,
} from '@/lib/platform-guide'
import { isPaidSource } from '@/lib/paid-sources'
import { absolute, buildMetadata } from '@/lib/seo'
import './platforms.css'

const path = '/platforms'
const markdown = '/guides/platforms.md'
const title = 'Freelance lead sources and paid job platforms | Lead To Client'
const description = 'Compare 12 freelance lead sources, from Reddit and Shopify Community to contract job boards, GitHub bounties and Mastodon hiring posts. See what each search covers.'
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
    <h1>Where to find freelance leads and paid projects</h1>
    <QuickAnswer>{platformGuideAnswer}</QuickAnswer>
    <p className="mk-meta">Updated <time dateTime={platformGuideUpdated}>{updatedLabel}</time> · <a href={markdown}>Markdown edition</a></p>
    <nav aria-label="Platform guide sections" className="platform-jump-links">
      <a href="#paid-freelance-jobs">Paid freelance jobs</a>
      <a href="#community-sources">Community sources</a>
      <a href="#freshness">Post age and search timing</a>
    </nav>
    <section aria-labelledby="paid-freelance-jobs">
      <h2 id="paid-freelance-jobs">Which platforms list paid freelance work?</h2>
      <p>{platformBrowseAnswer}</p>
      <SourceList rows={paidRows} />
      <Link className="mk-btn" href="/app/research?mode=paid&window=15">Search paid freelance jobs</Link>
    </section>
    <section aria-labelledby="community-sources">
      <h2 id="community-sources">Where do people ask for help?</h2>
      <p>Search these eight sources for the work you do. Live Research distinguishes hiring requests, requests for help and related discussions so you can decide which conversations to join.</p>
      <SourceList rows={communityRows} />
    </section>
    <section>
      <h2>Which sources work without an API key?</h2>
      <p>{platformAccessAnswer}</p>
    </section>
    <section aria-labelledby="freshness">
      <h2 id="freshness">Can I find a post from the last 15 minutes?</h2>
      <p>{platformFreshnessAnswer}</p>
      <p>For example, at 10:10 UTC a post published at 10:04 UTC is six minutes old. It qualifies for the 15-minute window if the source has made it available and it matches your search.</p>
      <h3>How do I read the search runtime?</h3>
      <p>{platformRuntimeAnswer}</p>
    </section>
    <section>
      <h2>Which searches can run automatically?</h2>
      <p>{platformWatchAnswer}</p>
      <p><Link href="/how-it-works">How saved searches and alerts work</Link> · <Link href="/faq">More questions about finding leads</Link></p>
    </section>
    <JsonLd data={{
      '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': absolute(path + '#page'),
      url: absolute(path), name: 'Freelance lead sources and paid job platforms', description,
      inLanguage: 'en', dateModified: platformGuideUpdated, isPartOf: { '@id': absolute('/#website') },
      about: { '@id': absolute('/#app') }, publisher: { '@id': absolute('/#organization') },
      mainEntity: {
        '@type': 'ItemList', name: 'Lead To Client Live Research sources', numberOfItems: directory.length,
        itemListElement: directory.map((row, index) => ({
          '@type': 'ListItem', position: index + 1, name: row.name, url: absolute(path + '#' + row.id),
        })),
      },
    }} />
  </main>
}
