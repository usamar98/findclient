import Link from 'next/link'
import { LifetimeLink } from '@/components/marketing/lifetime-link'
import { z } from 'zod'
import { posts } from '@/lib/posts'
import { absolute, buildMetadata } from '@/lib/seo'
import { Breadcrumbs, JsonLd, QuickAnswer } from '@/components/marketing/seo'
export function generateMetadata() {
  return buildMetadata({
    title: 'Freelance client-finding guides | Clientfind',
    description:
      'Learn how to find Shopify requests, compare monitoring tools, choose freelance communities and write a useful proposal from a public brief.',
    path: '/blog',
  })
}
export default async function Blog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const all = posts(),
    updated = all
      .map((p) => p.updated)
      .sort()
      .at(-1)
  const filter = z
    .object({
      q: z.string().trim().max(100).catch(''),
      category: z.string().max(60).catch(''),
      tag: z.string().max(60).catch(''),
    })
    .parse(await searchParams)
  const result = all.filter(
    (p) =>
      (!filter.category || p.category === filter.category) &&
      (!filter.tag || p.tags.includes(filter.tag)) &&
      (!filter.q ||
        [p.title, p.description, p.category, ...p.tags]
          .join(' ')
          .toLowerCase()
          .includes(filter.q.toLowerCase())),
  )
  return (
    <main className="guides-wrap">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Journal', href: '/blog' },
        ]}
      />
      <header className="journal-masthead">
        <h1>The Clientfind Journal</h1>
        <p>Field guides for finding freelance clients.</p>
      </header>
      <QuickAnswer>
        Start with a community where buyers describe a problem you can solve.
        These guides explain how to recognize a real request, choose a useful
        place to search, write a practical first reply and turn an invitation to
        help into a small, clearly scoped project.
      </QuickAnswer>
      <p className="guide-byline">
        Last updated <time dateTime={updated}>{updated}</time>
        <Link href="/rss.xml">RSS feed</Link>
      </p>
      <h2>Which guide fits your next step?</h2>
      <p>
        Search for a skill or choose a category. Each guide includes examples
        you can adapt to the public request in front of you.
      </p>
      <form className="guide-filter" action="/blog">
        <label>
          Search guides
          <input name="q" defaultValue={filter.q} maxLength={100} />
        </label>
        <label>
          Category
          <select name="category" defaultValue={filter.category}>
            <option value="">All categories</option>
            {Array.from(new Set(all.map((p) => p.category))).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <select name="tag" defaultValue={filter.tag}>
            <option value="">All tags</option>
            {Array.from(new Set(all.flatMap((p) => p.tags)))
              .sort()
              .map((t) => (
                <option key={t}>{t}</option>
              ))}
          </select>
        </label>
        <button>Find guides</button>
      </form>
      {result.length ? (
        <ul className="guide-cards">
          {result.map((p) => (
            <li key={p.slug}>
              <small>
                {p.category} · {p.minutes} min read
              </small>
              <h3>
                <Link href={'/blog/' + p.slug}>{p.title}</Link>
              </h3>
              <p>{p.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No guides match those filters.{' '}
          <Link href="/blog">Show all guides</Link>
        </p>
      )}
      <p>
        <LifetimeLink className="guide-cta" />
      </p>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Clientfind guides',
          url: absolute('/blog'),
          dateModified: updated,
        }}
      />
    </main>
  )
}
