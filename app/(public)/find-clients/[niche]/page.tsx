import Link from 'next/link'
import { LifetimeLink } from '@/components/marketing/lifetime-link'
import { notFound } from 'next/navigation'
import { niches } from '@/lib/niche-content'
import { buildMetadata, absolute } from '@/lib/seo'
import { contentUpdated } from '@/lib/public-pages'
import {
  Breadcrumbs,
  FAQ,
  JsonLd,
  QuickAnswer,
} from '@/components/marketing/seo'
import '../../blog/guides.css'
type Props = { params: Promise<{ niche: string }> }
function nicheBySlug(slug: string) {
  const item = niches.find((n) => n.slug === slug)
  if (!item) notFound()
  return item
}
export function generateStaticParams() {
  return niches.map((n) => ({ niche: n.slug }))
}
export const dynamicParams = false
export async function generateMetadata({ params }: Props) {
  const { niche } = await params,
    p = nicheBySlug(niche)
  return buildMetadata({
    title: p.title,
    description: p.description,
    path: '/find-clients/' + niche,
  })
}
export default async function Niche({ params }: Props) {
  const { niche } = await params,
    p = nicheBySlug(niche),
    path = '/find-clients/' + niche
  return (
    <main className="guides-wrap guide-prose">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: p.skill + ' clients', href: path },
        ]}
      />
      <h1>{p.title}</h1>
      <QuickAnswer>{p.quickAnswer}</QuickAnswer>
      <p>
        Last updated <time dateTime={contentUpdated}>{contentUpdated}</time>
      </p>
      <h2>Where do buyers describe this work?</h2>
      <p>
        Search for the problem in the buyer’s own words. Check the posting rules
        before offering paid help.
      </p>
      <ul>
        {p.where.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <h2>What does a qualified request look like?</h2>
      <p>
        These anonymized example types show what to listen for. Confirm the
        deliverable, deadline and buyer’s preferred contact channel in the
        original thread.
      </p>
      <ul>
        {p.examples.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <h2>How can Clientfind help me respond?</h2>
      <p>{p.approach}</p>
      <FAQ items={[...p.faq]} />
      <h2>Which related services could I offer?</h2>
      <p>
        Follow a nearby specialty when the work crosses disciplines. Keep
        separate keyword sets for requests that require different deliverables.
      </p>
      <ul>
        {p.related.map((slug) => {
          const r = niches.find((n) => n.slug === slug)
          return (
            r && (
              <li key={r.slug}>
                <Link href={'/find-clients/' + r.slug}>{r.title}</Link>
              </li>
            )
          )
        })}
      </ul>
      <p>
        <Link href="/tools/reddit-lead-finder">
          Search public Reddit requests
        </Link>
      </p>
      <LifetimeLink className="guide-cta" />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: p.title,
          url: absolute(path),
          dateModified: contentUpdated,
        }}
      />
    </main>
  )
}
