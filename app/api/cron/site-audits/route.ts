import { matchesSecret } from '@/lib/secrets'
import { runSiteAudits } from '@/lib/site-audit/jobs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    !matchesSecret(
      request.headers.get('authorization'),
      'Bearer ' + process.env.CRON_SECRET,
    )
  )
    return new Response('Unauthorized', { status: 401 })
  return Response.json(await runSiteAudits())
}
