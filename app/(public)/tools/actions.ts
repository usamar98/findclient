'use server'
import { z } from 'zod'
import { allowRequest } from '@/lib/limits'
import { generateReply } from '@/lib/ai'
import { searchPublic } from '@/lib/sources'
const ready = () =>
  Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
const forSearch = z.string().trim().min(2).max(80)
export async function publicSearch(input: unknown, redditOnlyInput: unknown) {
  const skill = forSearch.parse(input),
    redditOnly = z.boolean().parse(redditOnlyInput)
  if (!(await allowRequest('public-search', 8, 3600, true)))
    return { mode: 'Please wait before searching again.', hits: [] }
  if (!ready() || (redditOnly && !process.env.EXA_API_KEY))
    return { mode: 'Live search is unavailable.', hits: [] }
  try {
    const posts = await searchPublic(skill, redditOnly)
    const hits = posts.map(({ title, body, url, source, posted_at, author }) => ({
      title, author, body: body.slice(0, 370), url, source, posted_at,
    }))
    return { mode: hits.length ? 'Matching requests from the past 24 hours'
      : 'No matching requests were found in the past 24 hours.', hits }
  } catch {
    return { mode: 'The search providers are temporarily unavailable.', hits: [] }
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
