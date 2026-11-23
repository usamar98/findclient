import { notFound } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { Drafts } from '@/components/workspace/drafts'
import { statuses } from '@/lib/niche'
import { setStatus } from '../actions'
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { db, user } = await requireUser(),
    { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [{ data: lead, error }, { data: drafts, error: draftError }] =
    await Promise.all([
      db
        .from('leads')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      db
        .from('responses')
        .select('id,solution_md,pitch_md,tone')
        .eq('lead_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])
  if (error || draftError) throw new Error('Unable to load lead')
  if (!lead) notFound()
  return (
    <>
      <Link href="/app">Lead inbox</Link>
      <h1>{lead.title}</h1>
      <p>
        {lead.source} · {lead.author || 'Unknown author'} ·{' '}
        {lead.posted_at.slice(0, 10)}
      </p>
      <article>
        <h2>Original request</h2>
        <p className="whitespace-pre-wrap">{lead.body}</p>
        <a href={lead.url} target="_blank" rel="noopener noreferrer">
          Open original post
        </a>
        {lead.source === 'stackexchange' && (
          <p>
            Stack Overflow excerpt · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          </p>
        )}
      </article>
      <h2>Why this request matches</h2>
      <p>{lead.problem_summary}</p>
      <p>
        Intent {lead.intent_score}/100 · {lead.intent_reason}
      </p>
      <p>
        Budget signal: {lead.budget_signal || 'Unspecified'} · Urgency:{' '}
        {lead.urgency || 'Unspecified'}
      </p>
      <form action={setStatus}>
        <input type="hidden" name="id" value={id} />
        <label>
          Lead status
          <select name="status" defaultValue={lead.status}>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button>Update status</button>
      </form>
      <Drafts lead={id} drafts={drafts ?? []} />
    </>
  )
}
