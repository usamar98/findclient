import { z } from 'zod'

export const proposalCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'PKR'] as const
const textField = (limit: number) => z.string().trim().min(1).max(limit)
const logoPrefix = 'data:image/jpeg;base64,'
export function validProposalLogo(value: string) {
  if (value.length > 65536 || !value.startsWith(logoPrefix)) return false
  try {
    const bytes = atob(value.slice(logoPrefix.length))
    const word = (i: number) => bytes.charCodeAt(i) * 256 + bytes.charCodeAt(i + 1)
    if (word(0) !== 0xffd8 || word(bytes.length - 2) !== 0xffd9) return false
    for (let i = 2; i + 9 < bytes.length && bytes.charCodeAt(i) === 255;) {
      const marker = bytes.charCodeAt(i + 1)
      const length = word(i + 2)
      if (length < 2 || i + 2 + length > bytes.length || marker === 0xda) return false
      if (marker === 0xc0 || marker === 0xc2) {
        const height = word(i + 5), width = word(i + 7)
        const channels = bytes.charCodeAt(i + 9)
        return bytes.charCodeAt(i + 4) === 8 && [1, 3].includes(channels) && length === 8 + channels * 3
          && height > 0 && width > 0 && height <= 160 && width <= 480
      }
      i += 2 + length
    }
  } catch { return false }
  return false
}
export const proposalSchema = z.object({
  brand: textField(100),
  logo: z.string().refine(validProposalLogo, 'Choose a smaller JPG or PNG logo.').nullable().optional(),
  recipient: textField(140),
  title: textField(200),
  scope: textField(2400),
  currency: z.enum(proposalCurrencies),
  packages: z.array(z.object({
    name: textField(80),
    details: textField(800),
    priceCents: z.number().int().min(0).max(99999999999).nullable(),
    timeline: textField(150),
  })).min(1).max(3),
  contact: z.string().trim().max(200),
})

export type Proposal = z.infer<typeof proposalSchema>
export type ProposalAction = 'save' | 'publish' | 'rotate' | 'revoke'
export type ProposalRow = {
  lead_id: string
  document: Proposal
  published_document: Proposal | null
  revision: number
  share_token: string | null
  open_count: number
  first_opened_at: string | null
  last_opened_at: string | null
}
export type ProposalFunctions = {
  save_lead_proposal: {
    Args: { p_lead: string; p_document: Proposal | null; p_action: ProposalAction; p_revision: number }
    Returns: boolean
  }
  record_proposal_open: {
    Args: { p_token: string; p_visit: string }
    Returns: undefined
  }
}

export function defaultProposal(lead: { title: string; author: string | null; problem_summary: string }, brand: string): Proposal {
  return {
    brand: brand.trim().slice(0, 100) || 'Independent studio',
    recipient: lead.author?.trim().slice(0, 140) || 'Project team',
    title: lead.title.trim().slice(0, 200) || 'Project proposal',
    scope: lead.problem_summary.trim().slice(0, 2400) || lead.title.trim().slice(0, 2400) || 'Review the project requirements together.',
    currency: 'USD',
    packages: [{
      name: 'Project implementation',
      details: 'Review the requirements, agree on deliverables, and complete the work described in the project scope.',
      priceCents: null,
      timeline: 'To agree after scoping',
    }],
    contact: '',
  }
}

export function formatPrice(value: number | null, currency: Proposal['currency']) {
  if (value === null) return 'Quote after scoping'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, currencyDisplay: 'code',
    minimumFractionDigits: value % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(value / 100)
}
