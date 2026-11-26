import { z } from 'zod'
import { matchesSecret } from '@/lib/secrets'
import { admin } from '@/lib/db/admin'
import { runEngine } from '@/lib/engine'
import { deliverNotifications } from '@/lib/notifications'
import { queueTelegramJobAlerts } from '@/lib/job-alerts'
import { pruneHiringHistory, refreshSharedHiringFeed } from '@/lib/shared-hiring-feed'
import { reconcileQuotes } from '@/lib/checkout'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export async function GET(
  req: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  if (
    !process.env.CRON_SECRET ||
    !matchesSecret(
      req.headers.get('authorization'),
      'Bearer ' + process.env.CRON_SECRET,
    )
  )
    return new Response('Unauthorized', { status: 401 })
  const name = z
    .enum(['scan', 'continue-scan', 'notifications', 'job-alerts', 'hiring-feed', 'digest', 'maintenance'])
    .safeParse((await params).job)
  if (!name.success) return new Response('Unknown job', { status: 404 })
  const db = admin()
  const budget = await db.rpc('allow_request', {
    p_key: 'cron:' + name.data,
    p_limit: 4,
    p_window: 60,
  })
  if (budget.error) throw budget.error
  if (!budget.data)
    return new Response('Job request limit reached.', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  switch (name.data) {
    case 'hiring-feed':
      return Response.json(await refreshSharedHiringFeed())
    case 'job-alerts':
      return Response.json(await queueTelegramJobAlerts())
    case 'scan':
      return Response.json(await runEngine())
    case 'continue-scan':
      return Response.json(await runEngine(false))
    case 'notifications':
      return Response.json(await deliverNotifications())
    case 'digest': {
      const { error } = await db.rpc('queue_digests')
      if (error) throw error
      return Response.json({ queued: true })
    }
    case 'maintenance': {
      const { error } = await db.rpc('refill_credits')
      if (error) throw error
      await reconcileQuotes()
      await pruneHiringHistory()
      return Response.json({ ok: true })
    }
  }
}
