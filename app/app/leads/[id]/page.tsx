import Link from 'next/link'
import { requireLeadAccess } from '@/lib/workspace-access'
import { Drafts } from '@/components/workspace/drafts'
import { LeadIntelligence } from '@/components/workspace/lead-intelligence'
import { LeadPipeline } from '@/components/workspace/lead-pipeline'
import { ProposalActions } from '@/components/workspace/proposal-actions'
import { SiteAudit } from '@/components/workspace/site-audit'
import { posterWebsite } from '@/lib/site-audit/target'
import { researchSourceLabels, type ResearchSourceId } from '@/lib/research-catalog'
export const maxDuration = 100
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { db, lead } = await requireLeadAccess(id)
  const [drafts, audit] = await Promise.all([
    db.from('responses').select('id,solution_md,pitch_md,tone').eq('lead_id', id).order('created_at', { ascending: false }),
    db.from('lead_site_audits').select('*').eq('lead_id', id).maybeSingle(),
  ])
  if (audit.error || drafts.error) throw new Error('Unable to load lead details.')
  const scored = lead.intent_score !== null
  return (
    <>
      <Link href="/app/inbox">Lead inbox</Link>
      <h1>{lead.title}</h1>
      <p>
        {researchSourceLabels[lead.source as ResearchSourceId] ?? lead.source} · {lead.author || 'Unknown author'} ·{' '}
        {lead.posted_at.slice(0, 10)} ·{' '}
        <a href={lead.url} target="_blank" rel="noopener noreferrer">
          {lead.score_method === 'manual' ? 'Apply on original listing ↗' : 'Open original post'}
        </a>
      </p>
      {lead.problem_summary && <p>{lead.problem_summary}</p>}
      {lead.score_method === 'local' && <p>Intent was estimated from the wording of the original post using local rules. This assessment used zero scoring credits.</p>}
      <details className="panel">
        <summary>Read original request</summary>
        <p className="whitespace-pre-wrap">{lead.body}</p>
        {lead.source === 'stackexchange' && (
          <p>
            Stack Overflow excerpt · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          </p>
        )}
      </details>
      <nav className="lead-sections" aria-label="Lead sections">
        {(scored ? ['Evidence','Website','Pipeline','Proposal','Reply'] : ['Pipeline','Website','Proposal','Reply']).map(label => <a key={label} href={'#' + label.toLowerCase()}>{label}</a>)}
      </nav>
      {scored && <div id="evidence" className="lead-section"><LeadIntelligence lead={lead} /></div>}
      {!scored && <div id="pipeline" className="lead-section"><LeadPipeline lead={lead} /></div>}
      <div id="website" className="lead-section"><SiteAudit id={id} audit={audit.data} suggested={posterWebsite(lead.title, lead.body, lead.url)} /></div>
      {scored && <div id="pipeline" className="lead-section"><LeadPipeline lead={lead} /></div>}
      <div id="proposal" className="lead-section"><ProposalActions leadId={id} /></div>
      <div id="reply" className="lead-section">
        {lead.rule_draft_capped && <p className="meta">The automatic reply was skipped because this scan reached its credit limit.</p>}
        <Drafts lead={id} drafts={drafts.data ?? []} />
      </div>
    </>
  )
}
