import Link from 'next/link'
import { Breadcrumbs, JsonLd } from '@/components/marketing/seo'
import { niches } from '@/lib/niche-content'
import { absolute, buildMetadata } from '@/lib/seo'
import '../blog/guides.css'

const path = '/find-clients'
const title = 'Find freelance clients by service'
const description = 'Choose your freelance service to find relevant communities, see examples of buyer requests and learn what to ask before you quote.'

export const metadata = buildMetadata({ title, description, path })

export default function ServiceGuides() {
  return (
    <main className="guides-wrap">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Find clients by service', href: path }]} />
      <h1>{title}</h1>
      <p>{description} A store owner looking for a theme fix will describe a different problem from a founder hiring a copywriter. Start with the words a buyer uses for the work you do.</p>
      <h2>Which service do you sell?</h2>
      <ul className="guide-cards">
        {niches.map((niche) => (
          <li key={niche.slug}>
            <h3><Link href={path + '/' + niche.slug}>{niche.skill}</Link></h3>
            <p>{niche.description}</p>
          </li>
        ))}
      </ul>
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
