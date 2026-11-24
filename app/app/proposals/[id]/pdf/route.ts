import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { isBillingOrigin } from '@/lib/origin'
import { workspaceProposal } from '@/lib/proposals/data'
import { parseProposalForm } from '@/lib/proposals/form'
import { proposalDownload } from '@/lib/proposals/pdf'

type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  const { draft } = await workspaceProposal((await params).id)
  return proposalDownload(draft)
}

// Download the form as it currently reads, including edits the studio has not published.
export async function POST(request: Request, { params }: Context) {
  if (!isBillingOrigin(request)) return new Response('Unexpected origin', { status: 403 })
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 })
  const { db } = await requireUser()
  const { data, error } = await db.from('leads').select('id').eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load lead')
  if (!data) return new Response(null, { status: 404 })
  const proposal = parseProposalForm(await request.formData())
  if (!proposal.success) return new Response('Review the proposal fields and try again.', { status: 400 })
  return proposalDownload(proposal.data)
}
