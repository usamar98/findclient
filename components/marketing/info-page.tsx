import Link from 'next/link'
import { LifetimeLink } from './lifetime-link'
import Image from 'next/image'
import { infoPages, type InfoSlug } from '@/lib/marketing-pages'
import { absolute, buildMetadata } from '@/lib/seo'
import { brandProfiles, organization } from '@/lib/brand'
import { liveResearchTimingFaq, marketingFaq, productFaq } from '@/lib/marketing-faq'
import {
  buyerQualityExample,
  buyerQualityMethod,
  coverageIntro,
  freshnessAnswer,
  sourceCoverage,
} from '@/lib/marketing-coverage'
import { staticPageUpdated } from '@/lib/public-pages'
import { Breadcrumbs, QuickAnswer, JsonLd, FAQ } from './seo'

export function infoMetadata(slug: InfoSlug) {
  const { title, description } = infoPages[slug]
  return buildMetadata({ title, description, path: '/' + slug })
}
export function InfoPage({ slug }: { slug: Exclude<InfoSlug, 'pricing'> }) {
  const page = infoPages[slug]
  const path = '/' + slug
  const updated = staticPageUpdated(path)
  const items =
    slug === 'faq'
      ? productFaq
      : slug === 'how-it-works'
        ? [marketingFaq[8], marketingFaq[12]]
        : []
  return (
    <main
      className={
        slug === 'how-it-works' ? 'mk-article cf-how-page' : 'mk-article'
      }
    >
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          {
            name: slug === 'faq' ? 'FAQ' : slug.replaceAll('-', ' '),
            href: path,
          },
        ]}
      />
      <div className="cf-info-intro">
        <div>
          <h1>{page.title}</h1>
          <QuickAnswer>{page.answer}</QuickAnswer>
        </div>
        {slug === 'how-it-works' && (
          <figure className="cf-how-example">
            <Image
              src="/previews/shopify-request.webp"
              alt="Example project request from Shopify Community"
              width={648}
              height={370}
              unoptimized
            />
            <figcaption>A request in your lead inbox</figcaption>
          </figure>
        )}
      </div>
      <p className="mk-meta">
        Last updated <time dateTime={updated}>{updated}</time>
      </p>
      {page.sections.length > 0 && (
        <div className="cf-info-sections">
          {page.sections.map(([title, body]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      )}
      {slug === 'how-it-works' && (
        <section id="live-research">
          <h2>How do I find paid freelance jobs posted today?</h2>
          <p>
            Open <Link href="/app/jobs">24-hour jobs</Link> to browse We Work
            Remotely, Remote OK, GitHub paid bounties and Mastodon hiring posts.
            Enter a skill to narrow the results. For the past minute, 15 minutes
            or hour, select the sources individually in Live Research. Each
            result links to the post and shows when the source published it.
          </p>
          <p>
            A short window can be empty while a feed catches up or when nobody
            has posted a matching request. Check the platform report to see
            how many posts each source reviewed and how long it took.
          </p>
        </section>
      )}
      {slug === 'how-it-works' && (
        <section id="source-coverage">
          <h2>How often do saved searches check each community?</h2>
          <p>{coverageIntro}</p>
          <div className="cf-coverage-table">
            <table>
              <caption>
                Saved community searches with Fast Discovery on
              </caption>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">What the search covers</th>
                  <th scope="col">Scan interval</th>
                </tr>
              </thead>
              <tbody>
                {sourceCoverage.map((row) => (
                  <tr key={row.sources}>
                    <th scope="row">{row.sources}</th>
                    <td>
                      {row.method} <a href={row.url}>{row.reference}</a>
                    </td>
                    <td>{row.fast ? '10 minutes' : '1 hour'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{freshnessAnswer}</p>
        </section>
      )}
      {slug === 'how-it-works' && (
        <section id="buyer-quality">
          <h2>How is buyer quality scored?</h2>
          <p>{buyerQualityMethod}</p>
          <p>{buyerQualityExample}</p>
        </section>
      )}
      {slug === 'about' && process.env.FOUNDER_NAME && (
        <section>
          <h2>Who founded Lead To Client?</h2>
          <p>
            {process.env.FOUNDER_NAME} founded Lead To Client.{' '}
            {process.env.FOUNDER_URL && (
              <a href={process.env.FOUNDER_URL}>Founder profile</a>
            )}
          </p>
        </section>
      )}
      {slug === 'about' && brandProfiles.length > 0 && (
        <section>
          <h2>Where can I find Lead To Client online?</h2>
          <ul>
            {brandProfiles.map((profile) => (
              <li key={profile.name}>
                <a href={profile.url}>{profile.name}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {slug === 'contact' && (
        <section>
          <h2>How can I reach support?</h2>
          {process.env.SUPPORT_EMAIL ? (
            <a href={'mailto:' + process.env.SUPPORT_EMAIL}>
              {process.env.SUPPORT_EMAIL}
            </a>
          ) : (
            <p>The support address will appear here when the service opens.</p>
          )}
        </section>
      )}
      {slug === 'faq' && (
        <section id="source-freshness" aria-labelledby="fresh-leads-heading">
          <h2 id="fresh-leads-heading">Finding fresh freelance leads</h2>
          {liveResearchTimingFaq.map(({ question, answer, introduction, sources }) => (
            <details key={question}>
              <summary>{question}</summary>
              {sources ? (
                <>
                  <p>{introduction}</p>
                  <ul>
                    {sources.map(row => (
                      <li key={row.id}><strong>{row.name}.</strong> {row.freshness}</li>
                    ))}
                  </ul>
                </>
              ) : <p>{answer}</p>}
            </details>
          ))}
          <p><Link href="/platforms#source-freshness">Compare source timing and see the publisher references</Link></p>
        </section>
      )}
      {items.length > 0 && <FAQ items={items} />}
      <div className="mk-answer-links">
        {['faq', 'how-it-works', 'about', 'changelog'].includes(slug) && (
          <>
            <Link href="/platforms">Compare Live Research platforms</Link>
            {' · '}
          </>
        )}
        {slug === 'faq' ? (
          <Link href="/how-it-works#source-coverage">
            See saved search sources and scan intervals
          </Link>
        ) : (
          <Link href="/faq">Browse all product questions</Link>
        )}
        {' · '}
        <Link href="/find-clients">Explore guides by service</Link>
      </div>
      <LifetimeLink className="mk-btn" />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type':
            slug === 'about'
              ? 'AboutPage'
              : slug === 'contact'
                ? 'ContactPage'
                : slug === 'faq'
                  ? 'FAQPage'
                  : 'WebPage',
          '@id': absolute(path) + '#webpage',
          name: page.title,
          url: absolute(path),
          description: page.description,
          inLanguage: 'en',
          dateModified: updated,
          isPartOf: { '@id': absolute('/#website') },
          ...(slug === 'about' && { mainEntity: organization }),
          ...(slug === 'how-it-works' && {
            about: { '@id': absolute('/#app') },
          }),
          ...(slug === 'faq' && {
            mainEntity: marketingFaq.map(({ question, answer }) => ({
              '@type': 'Question',
              name: question,
              acceptedAnswer: { '@type': 'Answer', text: answer },
            })),
          }),
        }}
      />
      {slug === 'how-it-works' && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: page.title,
            description: page.answer,
            dateModified: updated,
            mainEntityOfPage: { '@id': absolute(path) + '#webpage' },
            step: page.sections.map(([name, text], i) => ({
              '@type': 'HowToStep',
              position: i + 1,
              name,
              text,
            })),
          }}
        />
      )}
    </main>
  )
}
