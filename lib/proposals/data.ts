import 'server-only'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { admin } from '@/lib/db/admin'
import { requireUser } from '@/lib/db/server'
import { getWorkspacePeople } from '@/lib/workspace-access'
import { defaultProposal, proposalSchema } from './model'

export async function workspaceProposal(id: string) {
  if (!z.uuid().safeParse(id).success) notFound()
  const { db } = await requireUser()
  const [leadResult, draftResult] = await Promise.all([
    db.from('leads').select('id,user_id,title,author,problem_summary').eq('id', id).maybeSingle(),
    db.from('lead_proposals').select('*').eq('lead_id', id).maybeSingle(),
  ])
  if (leadResult.error || draftResult.error) throw new Error('Unable to load proposal')
  const lead = leadResult.data
  if (!lead) notFound()
  const row = draftResult.data
  if (row) return { lead, row, draft: proposalSchema.parse(row.document) }
  const team = await getWorkspacePeople(lead.user_id)
  return { lead, row, draft: defaultProposal(lead, team.find(person => person.id === lead.user_id)?.name ?? '') }
}

export async function sharedProposal(token: string) {
  if (!z.uuidv4().safeParse(token).success ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) notFound()
  const { data, error } = await admin().from('lead_proposals').select('published_document').eq('share_token', token).maybeSingle()
  if (error) throw new Error('Unable to load shared proposal')
  const result = proposalSchema.safeParse(data?.published_document)
  if (!result.success) notFound()
  return result.data
}
