import { assessBuyer, closedRequest } from './lead-intelligence'
import type { NicheInput } from './niche'
import type { NormalizedPost } from './sources/shared'
import type { scoreIntent } from './ai'
import { APIConnectionError } from 'openai/core/error'

export type ScoringIssue = 'missing_key' | 'auth' | 'quota' | 'model' | 'pricing' | 'cost_guard' | 'invalid_response' | 'unavailable'

export class ScoringError extends Error {
  constructor(readonly issue: ScoringIssue, message: string) {
    super(message)
  }
}

// Scope provider errors to scoring. An identical HTTP status from a source or database
// must not be interpreted as an OpenAI failure.
export function scoringIssue(problem: unknown): ScoringIssue | undefined {
  if (problem instanceof ScoringError) return problem.issue
  if (!problem || typeof problem !== 'object') return undefined
  const status = 'status' in problem ? problem.status : null
  const code = 'code' in problem ? problem.code : null
  if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') return 'quota'
  if (status === 401 || status === 403) return 'auth'
  if (status === 400 || status === 404 || status === 422) return 'model'
  if (status === 408 || status === 409 || status === 429 || (typeof status === 'number' && status >= 500)) return 'unavailable'
  if (problem instanceof APIConnectionError) return 'unavailable'
  return undefined
}

const generic = new Set('i we my our need needs needed looking seeking want wanted hiring hire freelance freelancer contractor expert agency help someone anyone work project service services paid budget to a an for with build fix the and developer engineer designer experienced senior'.split(' '))
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const hiring = /\b(?:we(?:'re| are) hiring|i(?:'m| am) hiring|(?:looking|seeking|want|need) to hire|(?:seeking|looking for|need) (?:an? |some )?(?:(?:senior|experienced|freelance|contract|software|web|frontend|backend|full.stack) ){0,3}(?:developer|engineer|designer|freelancer|contractor|agency|consultant)|hiring (?:an? |for (?:a |an )?)|(?:send|share) (?:me |us )?(?:a |your )?(?:quote|rates)|paid (?:project|opportunity))\b/i
const excludedSignals = [
  /\b(?:not|aren't|isn't|no longer) (?:currently )?(?:looking (?:for|to hire)|hiring|seeking)|\bno openings\b/i,
  /\b(?:not a paid|no budget|can't pay|cannot pay|unpaid|volunteers? only|free help only|(?:budget|pay) (?:is |of )?(?:zero|\$0\b))\b/i,
  /\b(?:(?:are you|is anyone) hiring|looking for (?:a |my next )?(?:job|work|clients)|seeking (?:work|employment)|hire me|for hire)\b/i,
  /\b(?:tips (?:on|for)|guide to|advice on|experience with) (?:hiring|looking for)\b/i,
]
const threadTitle = /^(?:ask hn:\s*)?(?:who is hiring|who wants to be hired|freelancer\?\s*seeking freelancer)\??\s*(?:\([^)]*\))?[?.!]*$/i

// Local matches require a request from the author and a concrete service phrase.
// Return no match for ambiguous text even when the user selected a zero threshold.
export function localIntent(post: NormalizedPost, niche: Pick<NicheInput, 'skill' | 'keywords'>) {
  const title = post.source === 'hn' && threadTitle.test(post.title.trim()) ? '' : post.title
  const text = [title, post.body].filter(Boolean).join('\n').replace(/[’‘]/g, "'")
  if (excludedSignals.some(pattern => pattern.test(text)) || closedRequest(text)) return null
  const request = hiring.exec(text)
  if (!request) return null
  const context = text.slice(Math.max(0, request.index - 200), request.index + request[0].length + 400)
  const words = ' ' + normalize(context) + ' '
  const service = [niche.skill, ...niche.keywords].find(phrase => {
    const normalized = normalize(phrase)
    return normalized.split(' ').some(word => word.length > 1 && !generic.has(word)) &&
      words.includes(' ' + normalized + ' ')
  })
  if (!service) return null
  const signals = assessBuyer({ ...post, title })
  if (signals.request_type === 'offering') return null
  // Use snippets from the original, preserving the author's punctuation as evidence.
  const original = [title, post.body].filter(Boolean).join('\n')
  const excerpt = original.slice(request.index, request.index + 180).split('\n')[0].trim()
  const evidence = { ...signals.evidence, request: excerpt }
  return {
    score: 75 + (signals.positive_budget ? 10 : 0) + (evidence.urgency ? 5 : 0),
    reason: 'Text-based scoring found a hiring request mentioning “' + service + '”.',
    problem_summary: excerpt,
    budget_signal: evidence.budget || 'Unspecified',
    urgency: evidence.urgency || 'Unspecified',
    request_type: 'hiring' as const,
    evidence,
  }
}

type Rating = Awaited<ReturnType<typeof scoreIntent>>
export async function evaluateScanPost(
  post: NormalizedPost,
  niche: Pick<NicheInput, 'skill' | 'keywords'>,
  providerIssue: ScoringIssue | undefined,
  scoreWithAI: () => Promise<Rating>,
): Promise<{ rating: Rating | null; issue?: ScoringIssue; providerIssue?: ScoringIssue }> {
  let issue = providerIssue
  if (!issue) {
    try {
      return { rating: await scoreWithAI() }
    } catch (error) {
      issue = scoringIssue(error)
      if (!issue) throw error
    }
  }
  return {
    rating: localIntent(post, niche),
    issue,
    providerIssue: issue === 'invalid_response' || issue === 'cost_guard' ? undefined : issue,
  }
}
