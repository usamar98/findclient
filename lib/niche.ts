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
export const statuses = ['new', 'saved', 'replied', 'call_booked', 'proposal_sent', 'won', 'lost', 'ignored'] as const
export const stageNames: Record<(typeof statuses)[number], string> = {
  new: 'Found', saved: 'Saved', replied: 'Replied', call_booked: 'Call booked',
  proposal_sent: 'Proposal sent', won: 'Won', lost: 'Lost', ignored: 'Ignored',
}
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
const threadId = /^[1-9]\d{0,11}$/
function hnThread(value: string) {
  if (threadId.test(value)) return value
  try {
    const u = new URL(value)
    if (u.origin === 'https://news.ycombinator.com' && !u.username && !u.password &&
        u.pathname === '/item' && u.searchParams.getAll('id').length === 1) {
      return u.searchParams.get('id') ?? ''
    }
  } catch { /* An invalid URL fails the ID validation below. */ }
  return ''
}
const subreddit = z.string().trim().toLowerCase().transform(s =>
  s.replace(/^(?:https:\/\/(?:www\.)?reddit\.com\/r\/|\/?r\/)/, '').replace(/\/$/, '')
).pipe(z.string().regex(/^[a-z0-9][a-z0-9_]{0,20}$/, 'Enter a subreddit name such as r/webflow.'))
const thread = z.string().trim().transform(hnThread).pipe(
  z.string().regex(threadId, 'Enter a Hacker News thread ID or its news.ycombinator.com/item link.'),
)
const uniqueWatches = (list: string[]) => Array.from(new Set(list))
export const nicheSchema = z.object({
  skill: z.string().trim().min(2).max(100),
  portfolio_url: portfolio,
  keywords: terms.min(1),
  negative_keywords: terms,
  subreddits: z.array(subreddit).max(10, 'Choose up to 10 subreddits.').transform(uniqueWatches).optional(),
  hn_threads: z.array(thread).max(10, 'Choose up to 10 Hacker News threads.').transform(uniqueWatches).optional(),
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
