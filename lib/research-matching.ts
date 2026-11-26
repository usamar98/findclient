import { closedRequest } from './lead-intelligence'
import type { NormalizedPost } from './sources/shared'

type Candidate = Pick<NormalizedPost, 'source' | 'url' | 'title' | 'body'> & { tags?: readonly string[] }
type Service = {
  role: RegExp
  searches: string[]
  subject: RegExp
  work: RegExp
  platform?: string
}

// Expand only recognized service names. A qualifier such as a language or a city
// belongs to the user's query and must survive on every matching result.
const services: Service[] = [
  {
    role: /^shopify(?: (?:developers?|devs?|designers?|experts?|development))?$/i,
    searches: ['Shopify', 'Liquid'], platform: 'shopify',
    subject: /\b(?:shopify|hydrogen storefront|dawn theme|theme\.liquid|liquid (?:templates?|syntax|filters?|themes?))\b/i,
    work: /\b(?:developers?|devs?|designers?|themes?|storefronts?|liquid|checkout|cart (?:drawers?|buttons?)|add to cart|metafields?|variants?|product pages?|sections?|webhooks?|storefront api|custom apps?|integrat\w*|redesign\w*)\b/i,
  },
  {
    role: /^wordpress(?: (?:developers?|devs?|designers?|experts?|development))?$/i,
    searches: ['WordPress', 'WooCommerce'], platform: 'wordpress',
    subject: /\b(?:wordpress|woocommerce|wp-admin|gutenberg|elementor)\b/i,
    work: /\b(?:developers?|designers?|themes?|plugins?|blocks?|checkout|templates?|hooks?|migration|redesign|widgets?)\b/i,
  },
  {
    role: /^woocommerce(?: (?:developers?|devs?|designers?|experts?|development))?$/i,
    searches: ['WooCommerce'], platform: 'woocommerce', subject: /\bwoo\s?commerce\b/i,
    work: /\b(?:developers?|designers?|themes?|plugins?|checkout|products?|variations?|cart|hooks?|payments?|integrat\w*)\b/i,
  },
  {
    role: /^webflow(?: (?:developers?|devs?|designers?|experts?|development))?$/i,
    searches: ['Webflow'], platform: 'webflow', subject: /\bwebflow\b/i,
    work: /\b(?:developers?|designers?|cms|collections?|interactions?|layouts?|breakpoints?|forms?|animations?|redesign\w*|custom code|localization)\b/i,
  },
  {
    role: /^bubble (?:developers?|devs?|experts?|development)\b$/i,
    searches: ['Bubble.io', 'Bubble workflow'], platform: 'bubble', subject: /\b(?:bubble\.io|bubble (?:app|workflow|developer))\b/i,
    work: /\b(?:developers?|workflows?|plugins?|databases?|privacy rules?|repeating groups?)\b/i,
  },
  {
    role: /^(?:web|website|ui ux|ux ui) design(?:ers?)?$/i,
    searches: ['website redesign', 'landing page'],
    subject: /\b(?:websites?|web design|landing pages?|ui.?ux|ux.?ui|homepages?)\b/i,
    work: /\b(?:design\w*|redesign\w*|layouts?|wirefram\w*|responsive|accessib\w*|conversion\w*)\b/i,
  },
  {
    role: /^(?:seo|search engine optimization)(?: (?:consultants?|specialists?|freelancers?|experts?))?$/i,
    searches: ['technical SEO', 'search console'], subject: /\b(?:seo|google search console|organic traffic|search rankings?|search engine optimi[sz]ation)\b/i,
    work: /\b(?:seo|index(?:ing|ation)?|rank(?:ing)?s?|organic traffic|canonical|audit|sitemaps?)\b/i,
  },
  {
    role: /^(?:software (?:engineers?|developers?)|web developers?)$/i,
    searches: ['software developer', 'web developer'],
    subject: /\b(?:software|web (?:applications?|apps?|developers?))\b/i,
    work: /\b(?:engineers?|developers?|development|build|implement\w*|integrat\w*|debug\w*)\b/i,
  },
  {
    role: /^video edit(?:ors?|ing)$/i, searches: ['video editor', 'edit footage'],
    subject: /\b(?:videos?|footage|premiere pro|davinci resolve)\b/i,
    work: /\b(?:edit\w*|color grad\w*|captions?|cutting|subtitles?)\b/i,
  },
]

function words(text: string) {
  // Keep technology identifiers distinguishable, including C++, C#, and .NET.
  return (text.normalize('NFKC').toLowerCase().match(/\.?[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?/gu) ?? [])
    .map(word => word.replace(/^(developer|designer|engineer|freelancer|expert)s$/, '$1'))
}

export function researchMatchPlan(input: string) {
  const original = input.trim().slice(0, 100)
  const terms = words(original)
  const service = services.find(item => item.role.test(original.replace(/\s+/g, ' ')))
  const queries = [original, ...(service?.searches ?? [])].filter((q, i, list) =>
    q && list.findIndex(other => other.toLowerCase() === q.toLowerCase()) === i)
  // Quoted phrases deliberately keep their literal scope.
  const phrases = [...original.matchAll(/"([^"]+)"/g)].map(match => words(match[1]).join(' ')).filter(Boolean)
  return { terms, phrases, service, queries }
}

type Plan = ReturnType<typeof researchMatchPlan>
export type ResearchMatchKind = 'hiring' | 'help' | 'topic'
export type ResearchMatch = { kind: ResearchMatchKind; excerpt: string }

const seller = /\b(?:hire me|for hire|open to work|seeking (?:work|clients|employment)|looking for (?:new |more |my next )?(?:clients|jobs?|work)|(?:available|availability) for (?:work|freelance|projects?|hire)|(?:i|we) (?:offer|provide) .{0,45}services|(?:i|we) help .{0,28}(?:brands?|merchants?|businesses|clients) (?:build|grow|scale)|i can help (?:you|your)|(?:dm|message|contact) (?:me|us) (?:for (?:a demo|my rates|our services)|today|if you need)|book (?:a|your) (?:free |discovery )?(?:call|demo)|use (?:our |my )?(?:discount|coupon) code|shop now|limited.time offer)\b/i
const consumer = /\b(?:where(?:'s| is) my (?:order|package)|(?:my|the) (?:order|parcel|package) (?:never |hasn.t |has not )?(?:arrived|shipped)|track my (?:order|package)|buy (?:a|an|this|these) .{0,30}(?:hoodie|shoes|dress)|coupon code for|refund for my (?:order|purchase))\b/i
const hire = /\b(?:(?:we(?:'re| are)|i(?:'m| am)) hiring|(?:hiring|seeking|looking for|need) (?:an? |some )?(?:(?:shopify|wordpress|webflow|software|freelance|web|video|senior|experienced|full.stack|react|seo) ){0,3}(?:developers?|engineers?|designers?|editors?|freelancers?|contractors?|consultants?|specialists?|experts?|copywriters?)|(?:looking|want|need) to hire|(?:seeking|looking for|need) someone (?:who can|to)|(?:share|send) (?:me |us )?(?:a |your )?(?:quote|rates)|paid (?:project|contract|gig))\b/i
const help = /\b(?:can (?:anyone|someone|somebody|you)|(?:how|what|why|where) (?:can|do|does|did|is|are|should|would)|any (?:ideas|advice|help|suggestions)|anyone (?:know|else experiencing)|(?:need|needs|needing) (?:some |your |urgent )?help|(?:i|we)(?:'m| are| am| have| keep)? (?:stuck|struggling|getting|trying to|need to)|(?:doesn't|does not|won't|will not|isn't|is not|stopped) (?:work\w*|load\w*|show\w*|updat\w*|display\w*|sav\w*|render\w*|respond\w*)|keeps? (?:failing|crashing)|(?:is |are |seems? )?(?:broken|throwing errors?)|error (?:when|while|after|in)|failing (?:to|after))\b/i
const blockedTask = /\b(?:i|we|my (?:customers|visitors|users)|our (?:customers|visitors|users)) (?:still )?(?:cannot|can't|can no longer) (?:get|use|find|load|open|save|edit|update|install|publish|change|add|remove|pay|check out|figure out|understand|connect|integrate|access)\b/i
const implementation = /\b(?:(?:is there (?:any|a) way|is it possible|has anyone (?:managed|figured out how)) to|(?:has|did) anyone (?:figure|figured|solve|fix|resolve|implement)\b|(?:can|could) (?:i|we)|(?:i|we)(?:'d| would) like to (?:add|change|integrate|remove|build|customi[sz]e|fix|set up|edit|redesign|update)|help (?:needed|wanted))\b/i
const breakage = /\b(?:syntax error|keeps? disappearing|disappears? on mobile|fails? to render|unable to (?:load|save|update)|not (?:loading|working|showing|updating))\b/i
const howToQuestion = /^\s*how to\s+[^?!.]{3,150}\?/i
const hiringHeadline = /^\s*(?:\[hiring\](?=[\s:]|$)|(?:now )?hiring(?:\s*[:–—-])?\s+(?:[\p{L}.#+-]+\s+){0,4}(?:developers?|designers?|engineers?|writers?|marketers?|artists?|editors?|specialists?)\b(?!\s+(?:is|was|can|has)\b))/iu
const instruction = /^\s*(?:guide (?:to|for)\b|(?:guide|tutorial|tips)\s*[:–—-]|tips for\b|how to\b(?![^?]*\?))/i
const denial = /\b(?:not (?:currently )?hiring|no longer (?:need|seeking)|not looking (?:for|to hire)|(?:is anyone|are you) hiring|nobody is hiring|not a job (?:post|offer))\b/i

function trustedPlatform(post: Candidate) {
  if (post.source === 'shopify') return 'shopify'
  if (post.source !== 'forums') return undefined
  try {
    const host = new URL(post.url).hostname
    if (host === 'wordpress.org') return 'wordpress'
    if (host === 'community.webflow.com' || host === 'discourse.webflow.com') return 'webflow'
    if (host === 'forum.bubble.io') return 'bubble'
  } catch { /* Unknown community. */ }
}

function plainEvidence(text: string) {
  return text.replace(/https?:\/\/\S+/gi, ' ').replace(/[’‘]/g, "'")
}

function literalTerms(text: string, plan: Plan) {
  const tokens = words(text)
  const available = new Set(tokens)
  const sequence = ' ' + tokens.join(' ') + ' '
  return plan.terms.length > 0 && plan.terms.every(term => available.has(term)) &&
    plan.phrases.every(phrase => sequence.includes(' ' + phrase + ' '))
}

/** Match the request against a nearby passage, keeping exact source text as evidence. */
export function matchResearchPost(plan: Plan, post: Candidate): ResearchMatch | null {
  const title = plainEvidence(post.title)
  const body = plainEvidence(post.body)
  const text = title + '\n' + body
  if (!plan.terms.length || seller.test(text) || closedRequest(text) || denial.test(text)) return null
  const service = plan.service
  if (service && consumer.test(text)) return null
  const scope = trustedPlatform(post)
  const tags = post.source === 'stackexchange' ? post.tags?.join(' ') ?? '' : ''
  const platformMatches = !!service?.platform && (service.platform === scope || words(tags).includes(service.platform))
  const headlineHasTopic = Boolean(service?.subject.test(title))
  const headlineHasWork = Boolean(service?.work.test(title))
  const headlineIsLiteral = literalTerms(title, plan)
  const instructionalTitle = instruction.test(title)
  let best: ResearchMatch | null = null
  // Source text can exceed a screen. Keep the evidence and subject within a short
  // passage so a hiring comment at the bottom of a long unrelated post cannot qualify it.
  for (const field of [post.title, post.body]) {
    for (let offset = 0; offset < field.length; offset += 220) {
      const original = field.slice(offset, offset + 320)
      const passage = plainEvidence(original)
      const literal = literalTerms(passage, plan)
      const related = service && (platformMatches || service.subject.test(passage) || (offset === 0 && headlineHasTopic)) &&
        (service.work.test(passage) || (offset === 0 && headlineHasWork))
      const inTitle = field === post.title
      const titleContext = !inTitle && offset === 0 && headlineIsLiteral
      if (!literal && !related && !titleContext) continue
      const hiring = instructionalTitle ? null : hire.exec(passage) || (offset === 0 ? hiringHeadline.exec(passage) : null)
      const asking = instructionalTitle || instruction.test(passage) ? null : help.exec(passage) || implementation.exec(passage) || breakage.exec(passage) || blockedTask.exec(passage) || howToQuestion.exec(passage)
      const kind: ResearchMatchKind | null = hiring ? 'hiring' : asking ? 'help' : literal ? 'topic' : null
      if (!kind) continue
      // plainEvidence only changes URL lengths, so locate the real phrase again for highlighting.
      const signal = (hiring || asking)?.[0]
      const realPosition = signal ? original.replace(/[’‘]/g, "'").toLowerCase().indexOf(signal.toLowerCase()) : 0
      const start = Math.max(0, realPosition - 70)
      const match: ResearchMatch = { kind, excerpt: original.slice(start, start + 240).trim() }
      if (kind === 'hiring') return match
      if (!best || (kind === 'help' && best.kind === 'topic')) best = match
    }
  }
  return best
}
