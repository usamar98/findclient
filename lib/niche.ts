import { z } from 'zod'
export const sources = {
  hn: 'Hacker News',
  bluesky: 'Bluesky',
  stackexchange: 'Stack Overflow',
  shopify: 'Shopify Community',
  reddit: 'Reddit',
  indiehackers: 'Indie Hackers',
  x: 'X',
  forums: 'Public forums',
} as const
export const skills = [
  'Shopify developer',
  'Shopify designer',
  'Web designer',
  'SEO freelancer',
  'Video editor',
  'Copywriter',
  'WordPress developer',
  'Webflow developer',
  'UI/UX designer',
  'Marketing agency',
]
export const statuses = ['new', 'saved', 'replied', 'won', 'ignored'] as const
export const tones = ['friendly', 'expert', 'short'] as const
export const portfolio = z
  .string()
  .trim()
  .max(300)
  .refine((s) => {
    if (!s) return true
    try {
      const u = new URL(s)
      return (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.port &&
        /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname) &&
        !/\.(internal|local|test|localhost)$/i.test(u.hostname)
      )
    } catch {
      return false
    }
  }, 'Use a public HTTPS portfolio URL.')
const terms = z.array(z.string().trim().min(1).max(100)).max(18)
export const nicheSchema = z.object({
  skill: z.string().trim().min(2).max(100),
  portfolio_url: portfolio,
  keywords: terms.min(1),
  negative_keywords: terms,
  sources: z
    .array(
      z.enum(
        Object.keys(sources) as [
          keyof typeof sources,
          ...(keyof typeof sources)[],
        ],
      ),
    )
    .min(1)
    .max(8),
  min_intent: z.coerce.number().int().min(0).max(100),
  active: z.boolean(),
  pitch_style: z.string().trim().max(800),
})
export type NicheInput = z.infer<typeof nicheSchema>
export const splitTerms = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  )
