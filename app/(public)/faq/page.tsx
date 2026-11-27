import Link from 'next/link'
import { LifetimeLink } from '@/components/marketing/lifetime-link'
import { Breadcrumbs, JsonLd } from '@/components/marketing/seo'
import { faqGroups, marketingFaq } from '@/lib/marketing-faq'
import { infoPages } from '@/lib/marketing-pages'
import { headingId } from '@/lib/posts'
import { staticPageUpdated } from '@/lib/public-pages'
import { absolute, buildMetadata } from '@/lib/seo'
import { researchSources } from '@/lib/research-catalog'
import './faq.css'

const path = '/faq'
const page = infoPages.faq
export const metadata = buildMetadata({ title: page.title, description: page.description, path })

const topicGuides: Record<string, { href: string; label: string }> = {
  'finding-freelance-work': { href: '/how-it-works#live-research', label: 'Walk through a freelance job search' },
  'freelance-niches': { href: '/find-clients', label: 'Find clients by freelance service' },
  platforms: { href: '/platforms', label: `Compare the ${researchSources.length} Live Research sources` },
  'source-freshness': { href: '/platforms#source-freshness', label: 'Compare source timing and publisher references' },
  'saved-searches': { href: '/how-it-works#source-coverage', label: 'Check saved search coverage and scan intervals' },
  'buyer-intent': { href: '/how-it-works#buyer-quality', label: 'See a worked buyer quality score' },
  'applications-and-replies': { href: '/tools/client-pitch-writer', label: 'Try the freelance pitch writer' },
  'proposals-and-pipeline': { href: '/tools/proposal-generator', label: 'Try the freelance proposal generator' },
  'alerts-and-agencies': { href: '/telegram', label: 'Set up Telegram job alerts' },
  'pricing-and-credits': { href: '/pricing', label: 'Check current pricing and credit allowances' },
}

export default function Page() {
  const updated = staticPageUpdated(path)

  return (
    <main className="faq-guide">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'FAQ', href: path }]} />
      <header className="faq-intro">
        <h1>Finding freelance leads and paid projects</h1>
        <p>{page.answer}</p>
        <p className="mk-meta">Last updated <time dateTime={updated}>{updated}</time></p>
      </header>
      <div className="faq-layout">
        <nav className="faq-topics" id="faq-topics" aria-labelledby="faq-topics-title">
          <h2 id="faq-topics-title">FAQ topics</h2>
          <ul>
            {faqGroups.map(group => (
              <li key={group.id}><a href={'#' + group.id}>{group.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="faq-sections">
          {faqGroups.map(group => {
            const titleId = group.id === 'source-freshness' ? 'fresh-leads-heading' : group.id + '-heading'
            const guide = topicGuides[group.id]
            return (
              <section id={group.id} key={group.id} aria-labelledby={titleId}>
                <h2 id={titleId}>{group.title}</h2>
                {group.items.map(({ question, answer, introduction, sources }) => {
                  const id = headingId(question)
                  return (
                    <div className="faq-question" key={question} id={id}>
                      <h3><a href={'#' + id}>{question}</a></h3>
                      {sources ? (
                        <>
                          <p>{introduction}</p>
                          <ul className="faq-source-times">
                            {sources.map(row => (
                              <li key={row.id}><strong>{row.name}.</strong> {row.freshness}</li>
                            ))}
                          </ul>
                        </>
                      ) : <p>{answer}</p>}
                    </div>
                  )
                })}
                <div className="faq-section-links">
                  {guide && <Link href={guide.href}>{guide.label}</Link>}
                  <a className="faq-back" href="#faq-topics">Back to topics</a>
                </div>
              </section>
            )
          })}
          <LifetimeLink className="mk-btn" />
        </div>
      </div>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': absolute(path + '#webpage'),
        url: absolute(path),
        name: page.title,
        description: page.description,
        inLanguage: 'en',
        dateModified: updated,
        isPartOf: { '@id': absolute('/#website') },
        mainEntity: marketingFaq.map(({ question, answer }) => ({
          '@type': 'Question',
          '@id': absolute(path + '#' + headingId(question)),
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      }} />
    </main>
  )
}
