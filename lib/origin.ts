export const canonicalOrigin = 'https://leadtoclient.app'

export function searchIndexingEnabled() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
  return (
    process.env.NODE_ENV === 'production' &&
    (!process.env.NEXT_PUBLIC_SITE_URL || siteOrigin() === canonicalOrigin)
  )
}

export function siteOrigin() {
  const preview = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
  if (preview) return new URL('https://' + preview).origin
  if (process.env.NEXT_PUBLIC_SITE_URL)
    return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production')
    return canonicalOrigin
  if (process.env.VERCEL_URL)
    return new URL('https://' + process.env.VERCEL_URL).origin
  return 'http://localhost:3000'
}

export function isBillingOrigin(req: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  const expected = configured ? siteOrigin() : new URL(req.url).origin
  return req.headers.get('origin') === expected
}
