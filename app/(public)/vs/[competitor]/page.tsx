import Link from 'next/link'
import { notFound } from 'next/navigation'
import { comparisons } from '@/lib/comparisons'
import { absolute, buildMetadata } from '@/lib/seo'
import { contentUpdated } from '@/lib/public-pages'
import {
  Breadcrumbs,
  FAQ,
  JsonLd,
  QuickAnswer,
} from '@/components/marketing/seo'
import '../../blog/guides.css'
type Props = { params: Promise<{ competitor: string }> }
function comparison(slug: string) {
  if (!Object.hasOwn(comparisons, slug)) notFound()
  return comparisons[slug as keyof typeof comparisons]
}
export const dynamicParams = false
export function generateStaticParams() {
  return Object.keys(comparisons).map((competitor) => ({ competitor }))
}
export async function generateMetadata({ params }: Props) {
  const { competitor } = await params,
    p = comparison(competitor)
  return buildMetadata({
    title: 'Clientfind vs ' + p.name + ' for freelancers',
    description: p.description,
    path: '/vs/' + competitor,
  })
}
export default async function Compare({ params }: Props) {
  const { competitor } = await params,
    p = comparison(competitor),
    path = '/vs/' + competitor
  const title = 'Clientfind vs ' + p.name
  const rows = [
    ['Primary task', 'Find requests that match a freelance service', p.goal],
    [
      'Where it looks',
      'Selected public networks, communities and indexed forum posts',
      p.coverage,
    ],
    [
      'What you receive',
      'Scored requests, a suggested solution and an editable pitch',
      p.output,
    ],
  ]
  return (
    <main className="guides-wrap guide-prose">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: title, href: path },
        ]}
      />
      <h1>{title}</h1>
      <QuickAnswer>{p.quick}</QuickAnswer>
      <p>
        Last updated <time dateTime={contentUpdated}>{contentUpdated}</time>
      </p>
      <h2>How do the workflows compare?</h2>
      <p>
        Compare the task you need to finish and the output you will use. Read
        the other product’s own description for current coverage and plan
        details. <a href={p.url}>{p.name} product information</a>
      </p>
      <div className="guide-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Decision</th>
              <th scope="col">Clientfind</th>
              <th scope="col">{p.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{p.question}</h2>
      <p>{p.answer}</p>
      <p>{p.fits}</p>
      <FAQ items={[p.faq]} />
      <p>
        <Link href="/alternatives/gummysearch">
          Compare four GummySearch alternatives
        </Link>{' '}
        · <Link href="/pricing">Review Clientfind pricing</Link>
      </p>
      <Link href="/auth/login">Find your first 3 clients free</Link>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          url: absolute(path),
          dateModified: contentUpdated,
          citation: p.url,
        }}
      />
    </main>
  )
}
