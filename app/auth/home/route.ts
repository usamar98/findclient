import { NextResponse } from 'next/server'
import { authConfigured, database } from '@/lib/db/server'
import { siteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

// Public pages remain cacheable. Only this short response depends on the session.
export async function GET(request: Request) {
  const db = authConfigured() ? await database() : null
  const signedIn = db ? Boolean((await db.auth.getUser()).data.user) : false
  const response = request.headers.get('accept') === 'application/json'
    ? NextResponse.json({ signedIn })
    : NextResponse.redirect(new URL(signedIn ? '/app' : '/', siteOrigin()))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Vary', 'Accept, Cookie')
  response.headers.set('X-Robots-Tag', 'noindex')
  return response
}
