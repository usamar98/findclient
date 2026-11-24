import Link from 'next/link'
import { publishFromLead } from '@/app/app/proposals/quick-actions'

export function ProposalActions({ leadId }: { leadId: string }) {
  return (
    <section className="panel">
      <h2>Project proposal</h2>
      <p>Customize the scope, packages, prices and timeline, or use the proposal prepared from this lead.</p>
      <div className="actions">
        <Link href={'/app/proposals/' + leadId}>Edit proposal</Link>
        <a href={'/app/proposals/' + leadId + '/pdf'} download>Download PDF</a>
        <form action={publishFromLead.bind(null, leadId)}><button>Get proposal share link</button></form>
      </div>
    </section>
  )
}
