import 'server-only'
import { headers } from 'next/headers'
import { createHash } from 'node:crypto'
import { admin } from './db/admin'
const previewWindows = new Map<string, { end: number; count: number }>()
function localWindow(key: string, limit: number, seconds: number) {
  const now = Date.now(),
    record = previewWindows.get(key)
  if (record && record.end > now) return ++record.count <= limit
  if (previewWindows.size >= 2048) {
    for (const [id, w] of previewWindows)
      if (w.end <= now) previewWindows.delete(id)
    if (previewWindows.size >= 2048) return false
  }
  previewWindows.set(key, { count: 1, end: now + seconds * 1000 })
  return true
}
export async function allowRequest(
  bucket: string,
  limit: number,
  seconds: number,
  freePreview = false,
) {
  const h = await headers()
  const ip = process.env.VERCEL
    ? h.get('x-vercel-forwarded-for') || 'unknown'
    : 'local'
  const key = createHash('sha256')
    .update(bucket + '|' + ip)
    .digest('hex')
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    // Only offline examples and local templates use the process-local preview budget.
    return freePreview && localWindow(key, limit, seconds)
  }
  const { data, error } = await admin().rpc('allow_request', {
    p_key: key,
    p_limit: limit,
    p_window: seconds,
  })
  return !error && data === true
}
