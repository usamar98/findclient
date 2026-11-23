'use server'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { allowRequest } from '@/lib/limits'
import { generateReply } from '@/lib/ai'
import { searchPublic } from '@/lib/sources'
import { redditSnapshot } from '@/lib/free-tools'
import { shopifySnapshot, snapshotDate } from '@/lib/demo-snapshot'
const ready = () =>
  Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
const forSearch = z.string().trim().min(2).max(80)
const cachedSearch = unstable_cache(
  async (q: string, reddit: boolean) => {
    return (await searchPublic(q, reddit))
      .slice(0, 3)
      .map(({ title, body, url, source, posted_at, author }) => ({
        title,
        author,
        body: body.slice(0, 370),
        url,
        source,
        posted_at,
      }))
  },
  ['clientfind-public-search-v2'],
  { revalidate: 3600 },
)
export async function publicSearch(input: unknown, redditOnlyInput: unknown) {
  const skill = forSearch.parse(input),
    redditOnly = z.boolean().parse(redditOnlyInput)
  const samples = redditOnly ? redditSnapshot : shopifySnapshot
  if (!(await allowRequest('public-search', 8, 3600, true)))
    return { mode: 'Please wait before searching again.', hits: [] }
  if (ready()) {
    try {
      if (!redditOnly || process.env.EXA_API_KEY) {
        const hits = await cachedSearch(skill.toLowerCase(), redditOnly)
        return {
          mode: hits.length
            ? 'Recent public results · cached for up to one hour'
            : 'No recent matching posts were returned.',
          hits,
        }
      }
    } catch {
      /* Keep the dated local examples accessible during a provider outage. */
    }
  }
  const tokens = skill
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  const hits = samples
    .filter((p) =>
      tokens.some((t) =>
        (p.title + ' ' + p.body + ' ' + p.source).toLowerCase().includes(t),
      ),
    )
    .slice(0, 3)
  return {
    mode: 'Saved examples from ' + snapshotDate + ' · live search unavailable',
    hits,
  }
}
const draftInput = z.object({
  tool: z.enum(['proposal-generator', 'client-pitch-writer']),
  problem: z.string().trim().min(12).max(2200),
  deliverable: z.string().trim().min(3).max(240),
  check: z.string().trim().min(3).max(240),
  tone: z.enum(['friendly', 'expert', 'short']),
})
export async function freeDraft(raw: unknown) {
  const { tool, problem, deliverable, check, tone } = draftInput.parse(raw)
  if (!(await allowRequest('free-writing', 5, 3600, true)))
    return { label: 'Please wait before requesting another draft.', text: '' }
  if (ready() && process.env.OPENAI_API_KEY) {
    try {
      const draft = await generateReply(
        {
          title:
            tool === 'proposal-generator'
              ? 'A scoped freelance proposal'
              : 'A short personal pitch',
          body: problem,
        },
        tone,
        'Proposed deliverable: ' + deliverable + '. Acceptance check: ' + check,
      )
      return {
        label: 'AI draft · review before sending',
        text:
          tool === 'proposal-generator'
            ? draft.solution_md + '\n\n' + draft.pitch_md
            : draft.pitch_md,
      }
    } catch {
      /* A user can still assemble a scoped proposal from their own details. */
    }
  }
  const intro =
    tone === 'friendly'
      ? 'Thanks for describing the issue. '
      : tone === 'expert'
        ? 'My understanding of the brief is: '
        : 'Brief: '
  const text =
    tool === 'proposal-generator'
      ? intro +
        problem +
        '\n\nFirst deliverable: ' +
        deliverable +
        '\n\nAcceptance check: ' +
        check +
        '\n\nCould you share a representative example so I can confirm the scope, timeline and price?'
      : intro +
        problem +
        '\n\nI can help with ' +
        deliverable +
        '. My first check would be: ' +
        check +
        '. Would a short scope for that first step be helpful?'
  return { label: 'Template draft using your details', text }
}
