import { indexNowKey } from '@/lib/indexnow'
export function GET() {
  const key = indexNowKey()
  return new Response(key ?? 'Key unavailable', {
    status: key ? 200 : 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
