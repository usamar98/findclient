import Link from 'next/link'
import type { ReactNode } from 'react'
import { absolute } from '@/lib/seo'

export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
export type Crumb = { name: string; href: string }
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav className="cf-breadcrumb" aria-label="Breadcrumb">
        <ol>
          {items.map((item, i) => (
            <li key={item.href}>
              {i === items.length - 1 ? (
                <span aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.href}>{item.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: absolute(item.href),
          })),
        }}
      />
    </>
  )
}
export function QuickAnswer({ children }: { children: ReactNode }) {
  return (
    <aside className="guide-answer" aria-label="Quick answer">
      <strong>Quick answer</strong>
      <p>{children}</p>
    </aside>
  )
}
export function FAQ({
  items,
  title = 'What else do freelancers ask?',
}: {
  items: readonly { question: string; answer: string }[]
  title?: string
}) {
  return (
    <section aria-label="Frequently asked questions">
      <h2>{title}</h2>
      {items.map(({ question, answer }) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  )
}
