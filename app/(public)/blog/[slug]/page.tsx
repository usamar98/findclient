import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LifetimeLink } from '@/components/marketing/lifetime-link'
import { getPost, posts, relatedPosts } from '@/lib/posts'
import { absolute, buildMetadata } from '@/lib/seo'
import { Breadcrumbs, JsonLd, QuickAnswer } from '@/components/marketing/seo'
import { PostBody } from '@/components/marketing/post-body'
type Props = { params: Promise<{ slug: string }> }
export function generateStaticParams() {
  return posts().map((p) => ({ slug: p.slug }))
}
export const dynamicParams = false
export async function generateMetadata({ params }: Props) {
  const post = getPost((await params).slug)
  if (!post) notFound()
  return buildMetadata({
    title: post.title,
    description: post.description,
    path: '/blog/' + post.slug,
    type: 'article',
    published: post.published,
    updated: post.updated,
    keywords: post.tags,
  })
}
export default async function Article({ params }: Props) {
  const post = getPost((await params).slug)
  if (!post) notFound()
  const path = '/blog/' + post.slug,
    url = absolute(path)
  const procedure = post.procedure
    ? post.procedure.sections.map(
        (id) => post.toc.find((heading) => heading.id === id)!,
      )
    : []
  return (
    <main className="guides-wrap">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Blog', href: '/blog' },
          { name: post.title, href: path },
        ]}
      />
      <article>
        <h1>{post.title}</h1>
        <QuickAnswer>{post.quickAnswer}</QuickAnswer>
        <p className="guide-byline">
          By <Link href="/about">{post.author}</Link> · {post.minutes} min read
          · Last updated <time dateTime={post.updated}>{post.updated}</time>
        </p>
        <p className="guide-links">
          {post.tags.map((tag) => (
            <Link href={'/blog?tag=' + encodeURIComponent(tag)} key={tag}>
              {tag}
            </Link>
          ))}
        </p>
        <nav aria-label="Table of contents" className="guide-toc">
          <strong>In this guide</strong>
          <ol>
            {post.toc.map((h) => (
              <li key={h.id}>
                <a href={'#' + h.id}>{h.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <PostBody source={post.body} />
      </article>
      <section>
        <h2>What should I read next?</h2>
        <ul>
          {relatedPosts(post).map((p) => (
            <li key={p.slug}>
              <Link href={'/blog/' + p.slug}>{p.title}</Link>
            </li>
          ))}
        </ul>
      </section>
      <p>
        <LifetimeLink className="guide-cta" />
      </p>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          '@id': url + '#article',
          mainEntityOfPage: url,
          headline: post.title,
          description: post.description,
          datePublished: post.published,
          dateModified: post.updated,
          inLanguage: 'en',
          isPartOf: { '@id': absolute('/blog#journal') },
          author: {
            '@type': 'Organization',
            name: post.author,
            url: absolute('/about'),
          },
          publisher: {
            '@type': 'Organization',
            '@id': absolute('/#organization'),
            name: 'Lead To Client',
          },
          articleSection: post.category,
          keywords: post.tags,
          image: absolute('/og?title=' + encodeURIComponent(post.title)),
        }}
      />
      {procedure.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: post.procedure?.name ?? post.title,
            dateModified: post.updated,
            step: procedure.map((h, i) => ({
              '@type': 'HowToStep',
              position: i + 1,
              name: h.title,
              text: h.summary,
              url: url + '#' + h.id,
            })),
          }}
        />
      )}
    </main>
  )
}
