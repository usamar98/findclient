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
    description: 'Find freelance leads on Reddit, Hacker News and other communities. Check buyer intent, tailor your pitch with a website audit, and track branded proposals.',
    path: '/',
  })
}

const steps = [
  { title: 'Choose where to look', text: 'Save the service you sell and the phrases buyers use. You can watch specific subreddits or individual Hacker News hiring threads.' },
  { title: 'Read the buyer’s own words', text: 'The intent score tells you how closely a post matches your service. The buyer quality score highlights clues such as a stated budget, a business website or a deadline.' },
  { title: 'Write a reply in your voice', text: 'Add your portfolio and a few replies you’ve written so drafts use your phrasing. Edit the reply, then open the original post and decide what to send.' },
]

export default function Home() {
  return (
    <main className="cf-home">
      <DiscoveryHero />
      <section className="cf-home-section cf-directory" id="try-search">
        <div className="cf-section-intro">
          <h2>Who is asking for help?</h2>
          <p>Browse example requests across eight sources. Open a card to read the brief and a suggested first reply, or <Link href="/find-clients">explore guides for your service</Link>.</p>
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
      <section className="cf-home-section" aria-labelledby="lead-to-proposal">
        <div className="cf-section-intro"><h2 id="lead-to-proposal">From a freelance lead to a client proposal</h2></div>
        <div className="cf-proposal-story">
          <figure className="cf-lead-example">
            <figcaption>Example Shopify request</figcaption>
            <blockquote>“Our booking page is hard to use on phones. We have $800 to fix it before Friday. Can anyone help?”</blockquote>
            <dl>
              <dt>Why reply?</dt><dd>The merchant names the page, the budget and the deadline.</dd>
              <dt>Website audit finding</dt><dd>The booking page is missing its mobile viewport setting.</dd>
              <dt>A possible first reply</dt><dd>“I’d start with the viewport setting so the page fits a phone screen. Then I’d test the booking form on an iPhone and an Android. Which step gives your customers trouble?”</dd>
            </dl>
            <Link href="/blog/how-to-qualify-freelance-leads">How to qualify a freelance lead <span aria-hidden="true">↗</span></Link>
          </figure>
          <div className="cf-proposal-details">
            <div><h3>Website audits for your pitch</h3><p>When a lead includes a public website, check its speed, search metadata and mobile layout. A completed audit gives your reply a specific issue to discuss with the owner.</p></div>
            <div><h3>Branded proposals with open tracking</h3><p>Set the scope, packages, prices and timeline. Share a link your client can open without an account, or download the PDF. See when the link was first and last opened.</p>
              <Link href="/tools/proposal-generator">Try the free proposal outline generator <span aria-hidden="true">↗</span></Link></div>
            <div><h3>A shared inbox for your agency</h3><p>Assign the lead to a teammate and set a follow-up reminder. When you book a call or win the work, update the deal. Your pipeline totals the value of deals you mark won.</p></div>
          </div>
        </div>
      </section>
      <Offers />
      <div className="cf-home-section cf-faq"><FAQ items={[marketingFaq[3], marketingFaq[12], marketingFaq[15]]} />
        <Link href="/faq">Read all questions <span aria-hidden="true">↗</span></Link>
        <aside id="workspace-preview" className="cf-workspace-preview" aria-labelledby="workspace-preview-title">
          <h2 id="workspace-preview-title">What you can automate in your workspace</h2>
          <ul>
            <li>Run a saved search on demand with a credit cap and a receipt for each source. Set monthly search budgets and reserve credits for replies.</li>
            <li>Use rules to assign promising leads, prepare reply drafts or send a Telegram alert. Get notified when a proposal link is first opened and review a follow-up draft later.</li>
            <li>Compare replies, booked calls, won revenue and credits spent by platform or saved search.</li>
          </ul>
        </aside>
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
