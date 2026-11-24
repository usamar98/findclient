import { z } from 'zod'
import type { AuditFinding } from './analyze'
import { publicSite } from './target'

export type MobileAudit = {
  lcpMs?: number
  cls?: number
  performance?: number
  seo?: number
  accessibility?: number
  findings: AuditFinding[]
}

const envelope = z.object({
  error: z.never().optional(),
  lighthouseResult: z.object({
    requestedUrl: z.string().optional(),
    finalUrl: z.string().optional(),
    finalDisplayedUrl: z.string().optional(),
    runtimeError: z.null().optional(),
    configSettings: z
      .object({
        formFactor: z.string().optional(),
        emulatedFormFactor: z.string().optional(),
      })
      .optional(),
    categories: z.record(z.string(), z.unknown()).optional(),
    audits: z.record(z.string(), z.unknown()).optional(),
  }),
})
const categoryScore = z.object({ score: z.number().min(0).max(1) })
const metric = z.object({
  numericValue: z.number().nonnegative(),
  numericUnit: z.string().optional(),
  scoreDisplayMode: z.literal('numeric').optional(),
})
const failed = z.object({
  score: z.literal(0),
  scoreDisplayMode: z.literal('binary').optional(),
  details: z.object({ items: z.array(z.unknown()).optional() }).optional(),
})

// The baseline auditor supplies the final public HTTPS page. A result from
// another path (including a login, challenge or parked domain) cannot describe it.
function pageIdentity(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !publicSite(url.href)) return null
    url.hostname = url.hostname.replace(/^www\./i, '')
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    url.hash = ''
    url.searchParams.sort()
    return url.href
  } catch {
    return null
  }
}

const diagnosticRules = [
  {
    category: 'SEO',
    id: 'is-crawlable',
    problem: 'the page blocks search indexing',
    fix: 'Check whether the indexing restriction is intentional.',
  },
  {
    category: 'SEO',
    id: 'document-title',
    problem: 'a missing or empty page title',
    fix: 'Give this page a descriptive title.',
  },
  {
    category: 'SEO',
    id: 'crawlable-anchors',
    problem: 'links that crawlers cannot follow',
    fix: 'Give navigational links valid href destinations.',
  },
  {
    category: 'SEO',
    id: 'meta-description',
    problem: 'a missing meta description',
    fix: 'Add a short description specific to this page.',
  },
  {
    category: 'Design',
    id: 'color-contrast',
    problem: 'insufficient text contrast',
    fix: 'Check the flagged text colors against their backgrounds.',
  },
  {
    category: 'Design',
    id: 'target-size',
    problem: 'small or closely spaced tap targets',
    fix: 'Increase the size or spacing of the affected controls.',
  },
  {
    category: 'Design',
    id: 'button-name',
    problem: 'buttons without accessible names',
    fix: 'Add descriptive labels to the affected buttons.',
  },
  {
    category: 'Design',
    id: 'link-name',
    problem: 'links without accessible names',
    fix: 'Give each affected link a descriptive name.',
  },
] as const

export function parseMobileAudit(
  raw: unknown,
  expectedUrl: string,
): MobileAudit | null {
  const target = pageIdentity(expectedUrl)
  const parsed = envelope.safeParse(raw)
  if (!target || !parsed.success) return null
  const report = parsed.data.lighthouseResult
  const final = report.finalDisplayedUrl ?? report.finalUrl
  if (
    !final ||
    [final, report.finalUrl, report.requestedUrl].some(
      (url) => url !== undefined && pageIdentity(url) !== target,
    )
  )
    return null
  const forms = [
    report.configSettings?.formFactor,
    report.configSettings?.emulatedFormFactor,
  ]
  if (
    forms.some((form) => form !== undefined && form.toLowerCase() !== 'mobile')
  )
    return null

  const result: MobileAudit = { findings: [] }
  for (const key of ['performance', 'seo', 'accessibility'] as const) {
    const score = categoryScore.safeParse(report.categories?.[key])
    if (score.success) result[key] = Math.round(score.data.score * 100)
  }
  const lcp = metric.safeParse(report.audits?.['largest-contentful-paint'])
  if (
    lcp.success &&
    (!lcp.data.numericUnit || lcp.data.numericUnit === 'millisecond') &&
    lcp.data.numericValue > 0
  )
    result.lcpMs = Math.round(lcp.data.numericValue)
  const cls = metric.safeParse(report.audits?.['cumulative-layout-shift'])
  if (
    cls.success &&
    (!cls.data.numericUnit || cls.data.numericUnit === 'unitless')
  )
    result.cls = cls.data.numericValue
  if (result.lcpMs !== undefined && result.lcpMs > 2500) {
    result.findings.push({
      category: 'Speed',
      evidence:
        'The largest visible content took ' +
        (result.lcpMs / 1000).toFixed(1) +
        ' seconds to render in the mobile Lighthouse lab run.',
      recommendation:
        'Identify the largest content element and check what delays its rendering.',
    })
  } else if (result.cls !== undefined && result.cls > 0.1) {
    result.findings.push({
      category: 'Speed',
      evidence:
        'The mobile Lighthouse lab run measured a cumulative layout shift of ' +
        result.cls.toFixed(3) +
        '.',
      recommendation:
        'Inspect which elements move during load and reserve space for them.',
    })
  }
  for (const category of ['SEO', 'Design'] as const) {
    for (const rule of diagnosticRules) {
      if (rule.category !== category) continue
      const finding = failed.safeParse(report.audits?.[rule.id])
      if (!finding.success) continue
      const count = finding.data.details?.items?.length
      const observed = count
        ? ' (' + count + (count === 1 ? ' item' : ' items') + ' flagged)'
        : ''
      result.findings.push({
        category,
        evidence: 'Mobile Lighthouse flagged ' + rule.problem + observed + '.',
        recommendation: rule.fix,
      })
      break
    }
  }
  return result.findings.length > 0 || Object.keys(result).length > 1
    ? result
    : null
}

export async function mobileAudit(url: string): Promise<MobileAudit | null> {
  const key = process.env.PAGESPEED_API_KEY?.trim()
  if (!key || !pageIdentity(url)) return null
  const endpoint = new URL(
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  )
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('strategy', 'mobile')
  for (const category of ['performance', 'seo', 'accessibility'])
    endpoint.searchParams.append('category', category)
  endpoint.searchParams.set(
    'fields',
    'lighthouseResult(requestedUrl,finalUrl,configSettings,runtimeError,categories,audits)',
  )
  try {
    const response = await fetch(endpoint, {
      headers: { 'X-Goog-Api-Key': key },
      signal: AbortSignal.timeout(32000),
      redirect: 'error',
      cache: 'no-store',
    })
    if (!response.ok || !response.body) return null
    // Lighthouse reports can include base64 screenshots in individual audits.
    // Bound decompressed bytes even when the gateway omits Content-Length.
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        bytes += part.value.byteLength
        if (bytes > 12 * 1024 * 1024) return null
        chunks.push(part.value)
      }
    } finally {
      await reader.cancel()
    }
    return parseMobileAudit(
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
      url,
    )
  } catch {
    return null
  }
}
