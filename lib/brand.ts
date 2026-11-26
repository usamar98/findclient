import { absolute, siteConfig } from './seo'

const profiles = [
  ['X', process.env.BRAND_X_URL],
  ['GitHub', process.env.BRAND_GITHUB_URL],
  ['Product Hunt', process.env.BRAND_PRODUCT_HUNT_URL],
  ['LinkedIn', process.env.BRAND_LINKEDIN_URL],
] as const

export const brandProfiles = profiles.flatMap(([name, url]) =>
  url && URL.canParse(url) && new URL(url).protocol === 'https:'
    ? [{ name, url }]
    : [],
)

export const organization = {
  '@type': 'Organization',
  '@id': absolute('/#organization'),
  name: siteConfig.name,
  url: absolute('/'),
  logo: {
    '@type': 'ImageObject',
    '@id': absolute('/#logo'),
    url: absolute('/brand/logo-512.png'),
    width: 512,
    height: 512,
  },
  ...(brandProfiles.length > 0 && { sameAs: brandProfiles.map((profile) => profile.url) }),
  ...(process.env.FOUNDER_NAME && {
    founder: {
      '@type': 'Person',
      name: process.env.FOUNDER_NAME,
      url: process.env.FOUNDER_URL || undefined,
    },
  }),
}

export const softwareApplication = {
  '@type': 'SoftwareApplication',
  '@id': absolute('/#app'),
  name: siteConfig.name,
  url: absolute('/'),
  description: siteConfig.description,
  softwareHelp: { '@type': 'WebPage', url: absolute('/platforms') },
  featureList: [
    'Live Research across 12 public community, job and bounty sources',
    'Browse We Work Remotely and Remote OK contracts, GitHub paid bounties and Mastodon hiring posts with optional keywords',
    'Publication-time filters, original post links and listed compensation when available',
    'Search runtime and coverage for each selected source',
    'Buyer intent and quality scores with supporting evidence',
    'Website audits and personalized reply drafts',
    'Branded proposal PDFs and share links with open tracking',
    'Shared agency inbox with follow-up reminders and won revenue tracking',
  ],
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  publisher: { '@id': organization['@id'] },
  inLanguage: 'en',
}
