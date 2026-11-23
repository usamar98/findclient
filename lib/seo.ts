import type { Metadata } from 'next'
import { siteOrigin } from './origin'

const origin = siteOrigin()
const indexable =
  Boolean(process.env.NEXT_PUBLIC_SITE_URL) &&
  process.env.VERCEL_ENV !== 'preview'
export const siteConfig = {
  name: 'Clientfind',
  url: origin,
  description:
    'Find public requests that match your freelance skills, check buying intent and draft a useful solution and personal pitch.',
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || undefined,
  defaultOgImage: '/opengraph-image',
  indexable,
}
export const absolute = (path: string) => new URL(path, origin).href

export function buildMetadata({
  title,
  description,
  path,
  type = 'website',
  published,
  updated,
  keywords,
}: {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  published?: string
  updated?: string
  keywords?: string[]
}): Metadata {
  const url = absolute(path)
  const image =
    path === '/'
      ? absolute(siteConfig.defaultOgImage)
      : absolute('/og?title=' + encodeURIComponent(title))
  return {
    metadataBase: new URL(origin),
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical: indexable ? url : undefined,
      types: { 'application/rss+xml': absolute('/rss.xml') },
    },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: siteConfig.name,
      locale: 'en_US',
      images: [
        { url: image, width: 1200, height: 630, alt: title + ' · Clientfind' },
      ],
      ...(type === 'article'
        ? { publishedTime: published, modifiedTime: updated }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: siteConfig.twitterHandle,
      images: [image],
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: process.env.BING_SITE_VERIFICATION
        ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
        : undefined,
    },
  }
}
