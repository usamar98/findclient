import Link from 'next/link'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/wordmark'
import { Navigation } from '@/components/marketing/navigation'
import './marketing.css'
import './shell.css'
const groups = [
  {
    name: 'Explore',
    links: [
      ['How it works', '/how-it-works'],
      ['Platforms', '/platforms'],
      ['Pricing', '/pricing'],
      ['Journal', '/blog'],
      ['Questions', '/faq'],
    ],
  },
  {
    name: 'Find clients',
    links: [
      ['All service guides', '/find-clients'],
      ['Shopify developers', '/find-clients/shopify-developers'],
      ['Shopify designers', '/find-clients/shopify-designers'],
      ['Web designers', '/find-clients/web-designers'],
      ['Marketing agencies', '/find-clients/marketing-agencies'],
    ],
  },
  {
    name: 'Resources',
    links: [
      ['Reddit lead finder', '/tools/reddit-lead-finder'],
      ['Proposal generator', '/tools/proposal-generator'],
      ['Client pitch writer', '/tools/client-pitch-writer'],
      ['GummySearch alternatives', '/alternatives/gummysearch'],
    ],
  },
  {
    name: 'Lead To Client',
    links: [
      ['About', '/about'],
      ['Contact', '/contact'],
      ['Changelog', '/changelog'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
    ],
  },
]
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing">
      <a href="#cf-content" className="cf-skip">
        Skip to content
      </a>
      <Navigation />
      <div id="cf-content">{children}</div>
      <footer className="cf-footer"><div className="cf-footer-grid">
        <div className="cf-footer-brand"><Wordmark /><p>Find people already asking for your help.</p></div>
        {groups.map((g) => (
          <div key={g.name}>
            <strong>{g.name}</strong>
            {g.links.map(([name, url]) => (
              <Link key={url} href={url}>
                {name}
              </Link>
            ))}
          </div>
        ))}
      </div><div className="cf-footer-base">© {new Date().getUTCFullYear()} Lead To Client</div></footer>
      {/* Ship or Die / TrustMRR analytics slot. Replace with the official snippet or configure the script URL and site ID. */}
      {process.env.TRUSTMRR_SCRIPT_URL && (
        <Script
          id="trustmrr-traffic"
          src={process.env.TRUSTMRR_SCRIPT_URL}
          data-website-id={process.env.TRUSTMRR_WEBSITE_ID}
          strategy="afterInteractive"
        />
      )}
    </div>
  )
}
