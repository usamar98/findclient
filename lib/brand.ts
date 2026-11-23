import { absolute } from './seo'

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
  name: 'Clientfind',
  url: absolute('/'),
  sameAs: brandProfiles.map((profile) => profile.url),
  ...(process.env.FOUNDER_NAME && {
    founder: {
      '@type': 'Person',
      name: process.env.FOUNDER_NAME,
      url: process.env.FOUNDER_URL || undefined,
    },
  }),
}
