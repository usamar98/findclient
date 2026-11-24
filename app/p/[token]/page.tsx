import type { Metadata } from 'next'
import Image from 'next/image'
import { sharedProposal } from '@/lib/proposals/data'
import { formatPrice } from '@/lib/proposals/model'
import { OpenTracker } from './tracker'
import './proposal.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Project proposal', robots: { index: false, follow: false, nocache: true }, referrer: 'no-referrer',
}
export default async function PublishedProposal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const proposal = await sharedProposal(token)
  return (
    <main className="published-proposal">
      <header><div className="published-brand">
        {proposal.logo && <Image src={proposal.logo} width={150} height={50} unoptimized alt="" />}
        <strong>{proposal.brand}</strong>
      </div><a href={'/p/' + token + '/pdf'} download>Download PDF</a></header>
      <article>
        <div className="proposal-eyebrow">Project proposal</div>
        <h1>{proposal.title}</h1>
        <p className="prepared-for">Prepared for {proposal.recipient}</p>
        <section><h2>Scope of work</h2><p>{proposal.scope}</p></section>
        <section><h2>{proposal.packages.length === 1 ? 'Package' : 'Package options'}</h2>
          {proposal.packages.map((pack, i) => <div className="public-package" key={i}>
            <div><h3>{pack.name}</h3><strong>{formatPrice(pack.priceCents, proposal.currency)}</strong></div>
            <p>{pack.details}</p><p className="package-timeline">Timeline · {pack.timeline}</p>
          </div>)}
        </section>
        {proposal.contact && <section><h2>Contact</h2><p>{proposal.contact}</p></section>}
      </article>
      <OpenTracker token={token} />
    </main>
  )
}
