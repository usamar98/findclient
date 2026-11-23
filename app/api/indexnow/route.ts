import { z } from 'zod'
import { indexNowKey } from '@/lib/indexnow'
import { matchesSecret } from '@/lib/secrets'
import { publicPages } from '@/lib/public-pages'
import { absolute, siteConfig } from '@/lib/seo'
import { allowRequest } from '@/lib/limits'
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (
    !secret ||
    !matchesSecret(req.headers.get('authorization'), 'Bearer ' + secret)
  )
    return new Response('Unauthorized', { status: 401 })
  const key = indexNowKey()
  if (!key || !siteConfig.indexable)
    return new Response(
      'Configure the production origin and IndexNow key first.',
      { status: 503 },
    )
  if (!(await allowRequest('indexnow', 10, 3600)))
    return new Response('Submission limit reached.', { status: 429 })
  const payload = z
    .object({
      paths: z.array(z.string().max(300)).min(1).max(10000).optional(),
    })
    .safeParse(await req.json().catch(() => null))
  if (!payload.success)
    return new Response('Expected a JSON object with optional paths.', {
      status: 400,
    })
  const allowed = new Set(publicPages().map((p) => p.path)),
    paths = payload.data.paths ?? Array.from(allowed)
  if (paths.some((path) => !allowed.has(path)))
    return new Response('Each path must be a published page.', { status: 400 })
  const upstream = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: new URL(siteConfig.url).host,
      key,
      keyLocation: absolute('/indexnow-key.txt'),
      urlList: [...new Set(paths)].map(absolute),
    }),
    signal: AbortSignal.timeout(10000),
  })
  return Response.json(
    { accepted: upstream.ok, providerStatus: upstream.status },
    { status: upstream.ok ? 200 : 502 },
  )
}
