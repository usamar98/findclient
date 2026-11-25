import Link from 'next/link'
import { workspaceProposal } from '@/lib/proposals/data'
import { missingDatabaseResource } from '@/lib/db/missing-resource'
import { siteOrigin } from '@/lib/origin'
import { ProposalEditor } from './editor'
import { FollowupDraft } from './followup-draft'
import './editor.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC'
}

export default async function ProposalPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ changed?: string }>
}) {
  const { id } = await params
  const { db, row, draft } = await workspaceProposal(id)
  const { data: followup, error } = await db.from('proposal_followups').select('*').eq('lead_id',id).maybeSingle()
  if (error && !missingDatabaseResource(error, 'table', 'proposal_followups')) throw new Error('Unable to load follow-up activity.')
  const { changed } = await searchParams
  return (
    <>
      <Link href={'/app/leads/' + id}>Back to lead</Link>
      <h1>Project proposal</h1>
      {changed === '1' && <p role="status">A teammate edited the proposal. Review the latest draft before sharing.</p>}
      <ProposalEditor id={id} draft={draft} revision={row?.revision ?? 0}
        shareUrl={row?.share_token ? siteOrigin() + '/p/' + row.share_token : null} />
      <section className="panel" aria-labelledby="proposal-activity">
        <h2 id="proposal-activity">Link activity</h2>
        {row?.first_opened_at && row.last_opened_at ? (
          <dl className="proposal-activity">
            <div><dt>Browser visits</dt><dd>{row.open_count}</dd></div>
            <div><dt>First opened</dt><dd>{formatDate(row.first_opened_at)}</dd></div>
            <div><dt>Last opened</dt><dd>{formatDate(row.last_opened_at)}</dd></div>
          </dl>
        ) : <p>No recorded visits yet.</p>}
        <p className="meta">Recorded when a visitor displays the shared page. Anyone with the link can open it.</p>
        {followup && (followup.cancelled_at ? <p>Follow-up sequence stopped.</p>
          : followup.draft ? <FollowupDraft id={id} initial={followup.draft} />
          : <p>Follow-up draft scheduled for {formatDate(followup.due_at)}.</p>)}
      </section>
    </>
  )
}
