import { cookies } from 'next/headers'
import { z } from 'zod'
import { admin } from '@/lib/db/admin'
import { authConfigured, database } from '@/lib/db/server'
import { allowRequest } from '@/lib/limits'
import { isBillingOrigin } from '@/lib/origin'

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isBillingOrigin(request)) return new Response(null, { status: 403 })
  if (!z.uuidv4().safeParse(token).success) return new Response(null, { status: 400 })
  const visit = z.uuidv4().safeParse(request.headers.get('x-proposal-visit'))
  if (!visit.success) return new Response(null, { status: 400 })
  if (/bot\b|crawler|spider|preview|slurp/i.test(request.headers.get('user-agent') ?? ''))
    return new Response(null, { status: 204 })
  if (!await allowRequest('proposal-open', 120, 600)) return new Response(null, { status: 429 })
  const jar = await cookies()
  if (authConfigured() && jar.getAll().some(c => /^sb-.+-auth-token(?:\.\d+)?$/.test(c.name))) {
    const db = await database()
    const { data, error } = await db.from('lead_proposals').select('lead_id').eq('share_token', token).maybeSingle()
    if (data || error) return new Response(null, { status: 204 })
  }
  const { error } = await admin().rpc('record_proposal_open', { p_token: token, p_visit: visit.data })
  if (error) return new Response(null, { status: 503 })
  return new Response(null, { status: 204 })
}
