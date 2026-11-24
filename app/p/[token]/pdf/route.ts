import { sharedProposal } from '@/lib/proposals/data'
import { proposalDownload } from '@/lib/proposals/pdf'

export const dynamic = 'force-dynamic'
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  return proposalDownload(await sharedProposal((await params).token))
}
