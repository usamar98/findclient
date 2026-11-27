import type { Metadata } from 'next'
import { canonicalOrigin, searchIndexingEnabled } from './origin'
import { researchSources } from './research-catalog'

const origin = canonicalOrigin
const indexable = searchIndexingEnabled()
export const siteConfig = {
  name: 'Lead To Client',
  title: 'Find freelance leads and paid projects | Lead To Client',
  url: origin,
  description:
    `Find fresh freelance leads across ${researchSources.length} sources. Search by role, see when each job was posted, and apply to contracts, community hiring requests and paid bounties.`,
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
      canonical: url,
      types: { 'application/rss+xml': absolute('/rss.xml') },
    },
    robots: indexable
      ? { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }
      : { index: false, follow: false },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: siteConfig.name,
      locale: 'en_US',
      images: [
        { url: image, width: 1200, height: 630, alt: title },
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
