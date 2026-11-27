import Link from 'next/link'
import { Breadcrumbs, JsonLd } from '@/components/marketing/seo'
import { niches } from '@/lib/niche-content'
import { absolute, buildMetadata } from '@/lib/seo'
import '../blog/guides.css'

const path = '/find-clients'
const title = 'Find freelance clients by service'
const description = 'Find freelance clients for web development, design, SEO, video editing, copywriting or agency work. Get buyer search phrases and questions to ask before you quote.'

export const metadata = buildMetadata({ title, description, path })

export default function ServiceGuides() {
  return (
    <main className="guides-wrap">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Find clients by service', href: path }]} />
      <h1>{title}</h1>
      <p>A merchant hiring a developer might write “custom product template.” A founder hiring a copywriter might ask someone to “rewrite our pricing page.” Choose your service for search phrases, communities to check and questions to ask before quoting.</p>
      <h2>Which freelance clients are you looking for?</h2>
      <ul className="guide-cards">
        {niches.map((niche) => (
          <li key={niche.slug}>
            <h3><Link href={path + '/' + niche.slug}>{niche.skill}</Link></h3>
            <p>{niche.description}</p>
          </li>
        ))}
      </ul>
      <p>For a different specialty, enter a custom service in your saved search and use the phrases buyers use for that work. <Link href="/faq">Read the freelance lead search FAQ</Link>.</p>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': absolute(path + '#webpage'),
        url: absolute(path), name: title, description,
        isPartOf: { '@id': absolute('/#website') },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: niches.map((niche, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: niche.skill,
            url: absolute(path + '/' + niche.slug),
          })),
        },
      }} />
    </main>
  )
}
