import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { canonicalOrigin } from './lib/origin'
export async function middleware(request: NextRequest) {
  const u = request.nextUrl
  if (process.env.VERCEL_ENV !== 'preview') {
    const primary = process.env.NEXT_PUBLIC_SITE_URL || canonicalOrigin
    const canonical = new URL(primary)
    // Next may normalize nextUrl to the server's internal hostname.
    const hostname = (request.headers.get('host') || u.host)
      .toLowerCase()
      .replace(/:\d+$/, '')
      .replace(/\.$/, '')
    const canonicalAlias = hostname.replace(/^www\./, '') === canonical.hostname.replace(/^www\./, '')
    const productionAlias = process.env.VERCEL_ENV === 'production' &&
      [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL].includes(hostname)
    if (hostname !== canonical.hostname && (canonicalAlias || productionAlias)) {
      const target = new URL(canonical.origin)
      target.pathname = u.pathname
      target.search = u.search
      return NextResponse.redirect(target, ['GET', 'HEAD'].includes(request.method) ? 301 : 308)
    }
  }
  if (!/^\/app(?:\/|$)/.test(u.pathname)) return NextResponse.next()
  if (u.pathname === '/app/checkout/monthly' || u.pathname === '/app/checkout/free')
    return NextResponse.redirect(new URL('/pricing', u))
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const loginUrl = new URL('/auth/login', u)
  const query = new URLSearchParams(u.search)
  query.delete('_rsc')
  if (u.pathname !== '/app' || query.size) {
    loginUrl.searchParams.set('next', u.pathname + (query.size ? '?' + query.toString() : ''))
  }
  if (!url || !key) return NextResponse.redirect(loginUrl)
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of items)
          response.cookies.set(name, value, options)
      },
    },
  })
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) {
    const login = NextResponse.redirect(loginUrl)
    for (const cookie of response.cookies.getAll()) login.cookies.set(cookie)
    return login
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
