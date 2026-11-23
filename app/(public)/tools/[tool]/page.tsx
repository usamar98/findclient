import Link from 'next/link'
import { LifetimeLink } from '@/components/marketing/lifetime-link'
import { notFound } from 'next/navigation'
import { toolPages, redditSnapshot, type ToolName } from '@/lib/free-tools'
import { buildMetadata, absolute } from '@/lib/seo'
import {
  Breadcrumbs,
  FAQ,
  JsonLd,
  QuickAnswer,
} from '@/components/marketing/seo'
import { PublicSearch } from '@/components/marketing/public-search'
import { FreeWriter } from '@/components/marketing/free-writer'
import { contentUpdated } from '@/lib/public-pages'
import '../../blog/guides.css'
import './tool.css'
type Props = { params: Promise<{ tool: string }> }
function getTool(slug: string) {
  if (!Object.hasOwn(toolPages, slug)) notFound()
  return slug as ToolName
}
export function generateStaticParams() {
  return Object.keys(toolPages).map((tool) => ({ tool }))
}
export const dynamicParams = false
export async function generateMetadata({ params }: Props) {
  const slug = getTool((await params).tool),
    p = toolPages[slug]
  return buildMetadata({
    title: p.title,
    description: p.description,
    path: '/tools/' + slug,
  })
}
export default async function Tool({ params }: Props) {
  const slug = getTool((await params).tool),
    p = toolPages[slug],
    path = '/tools/' + slug
  return (
    <main className="guides-wrap tool-page">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: p.title, href: path },
        ]}
      />
      <h1>{p.title}</h1>
      <QuickAnswer>{p.quick}</QuickAnswer>
      <div className="tool-form">
        {slug === 'reddit-lead-finder' ? (
          <PublicSearch
            redditOnly
            initial={redditSnapshot}
            initialLabel="Saved Reddit examples · 23 November 2026"
          />
        ) : (
          <FreeWriter tool={slug} />
        )}
      </div>
      <h2>{p.question}</h2>
      <p>{p.answer}</p>
      <FAQ items={p.faq} />
      <p>
        Last updated <time dateTime={contentUpdated}>{contentUpdated}</time>
      </p>
      <div className="guide-links">
        <LifetimeLink className="guide-cta" />
        <Link href="/blog/how-to-write-a-forum-proposal">
          Read the forum proposal guide
        </Link>
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          url: absolute(path),
          name: p.title,
          dateModified: contentUpdated,
        }}
      />
    </main>
  )
}
