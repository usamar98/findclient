import Link from 'next/link'
import { LifetimeLink } from './lifetime-link'
import Image from 'next/image'
import { infoPages, type InfoSlug } from '@/lib/marketing-pages'
import { absolute, buildMetadata } from '@/lib/seo'
import { brandProfiles, organization } from '@/lib/brand'
import { marketingFaq } from '@/lib/marketing-faq'
import { Breadcrumbs, QuickAnswer, JsonLd, FAQ } from './seo'

export function infoMetadata(slug: InfoSlug) {
  const { title, description } = infoPages[slug]
  return buildMetadata({ title, description, path: '/' + slug })
}
export function InfoPage({ slug }: { slug: Exclude<InfoSlug, 'pricing'> }) {
  const page = infoPages[slug]
  const path = '/' + slug
  const items =
    slug === 'faq'
      ? marketingFaq
      : slug === 'how-it-works'
        ? [marketingFaq[8], marketingFaq[12]]
        : []
  return (
    <main className={slug === 'how-it-works' ? 'mk-article cf-how-page' : 'mk-article'}>
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
        <div><h1>{page.title}</h1><QuickAnswer>{page.answer}</QuickAnswer></div>
        {slug === 'how-it-works' && <figure className="cf-how-example">
          <Image src="/previews/shopify-request.webp" alt="Example project request from Shopify Community" width={648} height={370} unoptimized />
          <figcaption>A request in your lead inbox</figcaption>
        </figure>}
      </div>
      <p className="mk-meta">
        Last updated <time dateTime="2026-11-23">23 November 2026</time>
      </p>
      {page.sections.length > 0 && <div className="cf-info-sections">{page.sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}</div>}
      {slug === 'about' && process.env.FOUNDER_NAME && (
        <section>
          <h2>Who founded Clientfind?</h2>
          <p>
            {process.env.FOUNDER_NAME} founded Clientfind.{' '}
            {process.env.FOUNDER_URL && (
              <a href={process.env.FOUNDER_URL}>Founder profile</a>
            )}
          </p>
        </section>
      )}
      {slug === 'about' && brandProfiles.length > 0 && (
        <section>
          <h2>Where can I find Clientfind online?</h2>
          <ul>
            {brandProfiles.map((profile) => (
              <li key={profile.name}><a href={profile.url}>{profile.name}</a></li>
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
      {items.length > 0 && <FAQ items={items} />}
      <div className="mk-answer-links">
        <Link href={slug === 'faq' ? '/blog' : '/faq'}>
          {slug === 'faq'
            ? 'Explore the freelance guides'
            : 'Browse all Clientfind questions'}
        </Link>
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
                : 'WebPage',
          name: page.title,
          url: absolute(path),
          description: page.description,
          dateModified: '2026-11-23',
          ...(slug === 'about' && { mainEntity: organization }),
        }}
      />
      {slug === 'how-it-works' && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: page.title,
            description: page.answer,
            dateModified: '2026-11-23',
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
