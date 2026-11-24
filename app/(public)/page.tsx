import Link from 'next/link'
import { buildMetadata, absolute } from '@/lib/seo'
import { organization } from '@/lib/brand'
import { marketingFaq } from '@/lib/marketing-faq'
import { shopifySnapshot } from '@/lib/demo-snapshot'
import { DiscoveryHero, SourceExamples } from '@/components/marketing/home-discovery'
import { PublicSearch } from '@/components/marketing/public-search'
import { Offers } from '@/components/marketing/offers'
import { JsonLd, FAQ } from '@/components/marketing/seo'
import './home.css'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  return buildMetadata({
    title: 'Lead To Client | Freelance leads from Reddit and communities',
    description: 'Find freelance leads across Reddit, Hacker News and other communities. Check buyer intent, draft a personal reply and track proposals through to won work.',
    path: '/',
  })
}

const steps = [
  { title: 'Set your niche', text: 'Choose the skills you sell, where to look and which keywords to leave out.' },
  { title: 'Read the signals', text: 'See why a request matches, what the buyer needs and when they need it.' },
  { title: 'Start a conversation', text: 'Edit the suggested reply in your own voice, then open the original post to respond.' },
]

const comparison = [
  ['Discovery', 'Repeat searches on each site', 'Get priority alerts from your chosen sources'],
  ['Qualification', 'Read through every thread', 'Start with a score and the reason behind it'],
  ['Response', 'Write each reply from scratch', 'Edit a helpful answer and a personal pitch'],
  ['Follow-up', 'Check a spreadsheet for the next step', 'Assign leads, share proposals and track won revenue'],
]

export default function Home() {
  return (
    <main className="cf-home">
      <DiscoveryHero />
      <section className="cf-home-section cf-directory" id="try-search">
        <div className="cf-section-intro">
          <h2>Who is asking for help?</h2>
          <p>Browse example requests across eight sources. Open a card to read the brief and see a suggested first reply.</p>
        </div>
        <SourceExamples />
        <details className="cf-search-live">
          <summary>Search public discussions <span aria-hidden="true">↗</span></summary>
          <PublicSearch initial={shopifySnapshot} initialLabel="Saved Shopify Community discussions · 23 November 2026" />
        </details>
      </section>
      <section className="cf-workflow-band" id="how-it-works">
        <div className="cf-home-section">
          <div className="cf-section-intro">
            <h2>How Lead To Client works</h2>
            <Link href="/how-it-works">Explore the workflow <span aria-hidden="true">↗</span></Link>
          </div>
          <ol className="cf-workflow-grid">
            {steps.map((step, i) => (
              <li key={step.title}>
                <div aria-hidden="true" className={'cf-step-art cf-step-art-' + i}>
                  {i === 0 && <div className="cf-mini-niche"><small>Track a skill</small><b>Web design</b><span>+ Landing pages</span><span>+ Redesign</span></div>}
                  {i === 1 && <div className="cf-mini-score"><div><small>Example intent score</small><b>86<span> / 100</span></b></div><i /></div>}
                  {i === 2 && <div className="cf-mini-draft"><small>Personal pitch</small><b>I can help with the first screen.</b><span>▌</span></div>}
                </div>
                <div className="cf-step-copy"><h3>{step.title}</h3><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="cf-home-section cf-compare">
        <div><h2>How does it compare with manual search?</h2><p>Use the original post to decide who to contact. See <Link href="/blog/how-to-qualify-freelance-leads">how to qualify a freelance lead</Link> or <Link href="/find-clients">browse guides for your service</Link>.</p></div>
        <table>
          <thead><tr><th>Task</th><th>Manual search</th><th>Lead To Client</th></tr></thead>
          <tbody>{comparison.map(([task, manual, app]) => <tr key={task}><th scope="row">{task}</th><td>{manual}</td><td>{app}</td></tr>)}</tbody>
        </table>
      </section>
      <Offers />
      <div className="cf-home-section cf-faq"><FAQ items={[marketingFaq[3], marketingFaq[12], marketingFaq[15]]} />
        <Link href="/faq">Read all questions <span aria-hidden="true">↗</span></Link>
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            organization,
            {
              '@type': 'WebSite',
              '@id': absolute('/#website'),
              name: 'Lead To Client',
              url: absolute('/'),
              publisher: { '@id': absolute('/#organization') },
              inLanguage: 'en',
            },
            {
              '@type': 'WebPage',
              '@id': absolute('/#webpage'),
              url: absolute('/'),
              name: 'Lead To Client | Freelance leads from Reddit and communities',
              isPartOf: { '@id': absolute('/#website') },
              mainEntity: { '@id': absolute('/#app') },
            },
          ],
        }}
      />
    </main>
  )
}
