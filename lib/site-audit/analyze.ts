import { Parser } from 'htmlparser2'
import type { MobileAudit } from './mobile'

export type AuditFinding = {
  category: 'Speed' | 'SEO' | 'Design'
  evidence: string
  recommendation: string
}
export type SiteReport = {
  url: string
  checkedAt: string
  responseMs: number
  htmlBytes: number
  mobile?: Omit<MobileAudit, 'findings'>
  findings: AuditFinding[]
}

export function addMobileResults(
  report: SiteReport,
  mobile: MobileAudit | null,
): SiteReport {
  if (!mobile) return report
  const { findings: rendered, ...metrics } = mobile
  const findings = (['Speed', 'SEO', 'Design'] as const).flatMap((category) => {
    const finding =
      rendered.find((f) => f.category === category) ??
      report.findings.find((f) => f.category === category)
    return finding ? [finding] : []
  })
  return { ...report, mobile: metrics, findings }
}

export function analyzePage(
  url: string,
  html: string,
  htmlBytes: number,
  responseMs: number,
): SiteReport {
  let title = '',
    inTitle = false,
    description = '',
    headings = 0,
    viewport = ''
  let images = 0,
    unsizedImages = 0,
    missingAlt = 0,
    synchronousHeadScripts = 0,
    inHead = false
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'head') inHead = true
      if (name === 'title') inTitle = true
      if (name === 'h1') headings++
      if (name === 'meta') {
        const key = attrs.name?.toLowerCase()
        if (key === 'description') description = attrs.content?.trim() ?? ''
        if (key === 'viewport') viewport = attrs.content ?? ''
      }
      if (name === 'img') {
        images++
        if (!('alt' in attrs)) missingAlt++
        if (!attrs.width || !attrs.height) unsizedImages++
      }
      if (
        inHead &&
        name === 'script' &&
        attrs.src &&
        !('async' in attrs) &&
        !('defer' in attrs) &&
        (!attrs.type || /^(?:text|application)\/javascript$/i.test(attrs.type))
      )
        synchronousHeadScripts++
    },
    ontext(value) {
      if (inTitle) title += value
    },
    onclosetag(name) {
      if (name === 'title') inTitle = false
      if (name === 'head') inHead = false
    },
  })
  parser.end(html)
  const findings: AuditFinding[] = []
  if (responseMs > 1000)
    findings.push({
      category: 'Speed',
      evidence:
        'The server took ' +
        (responseMs / 1000).toFixed(1) +
        ' seconds to return headers in this check.',
      recommendation: 'Check caching and server response time.',
    })
  else if (htmlBytes > 175 * 1024)
    findings.push({
      category: 'Speed',
      evidence:
        'The HTML document alone was ' + Math.round(htmlBytes / 1024) + ' KiB.',
      recommendation:
        'Review large inline scripts, styles and repeated markup.',
    })
  else if (synchronousHeadScripts)
    findings.push({
      category: 'Speed',
      evidence:
        synchronousHeadScripts +
        ' external script(s) in the head load synchronously.',
      recommendation:
        'Check which scripts can be deferred until after the page renders.',
    })
  if (!title.trim())
    findings.push({
      category: 'SEO',
      evidence: 'The returned page has no nonempty title.',
      recommendation: 'Add a descriptive title for this page.',
    })
  else if (!description)
    findings.push({
      category: 'SEO',
      evidence: 'The returned HTML has no meta description.',
      recommendation:
        'Write a description that explains what visitors can do here.',
    })
  else if (!headings)
    findings.push({
      category: 'SEO',
      evidence: 'The returned page has no H1 heading.',
      recommendation: 'Give the page a descriptive main heading.',
    })
  if (!/width\s*=\s*device-width/i.test(viewport))
    findings.push({
      category: 'Design',
      evidence: 'The HTML has no device-width viewport setting.',
      recommendation:
        'Check the layout on a phone and set the mobile viewport.',
    })
  else if (missingAlt)
    findings.push({
      category: 'Design',
      evidence: missingAlt + ' of ' + images + ' images have no alt attribute.',
      recommendation:
        'Add accessible descriptions to meaningful images and empty alt text to decorative ones.',
    })
  else if (unsizedImages)
    findings.push({
      category: 'Design',
      evidence:
        unsizedImages + ' images have no explicit width or height in the HTML.',
      recommendation:
        'Check whether CSS reserves their space before loading to avoid layout shifts.',
    })
  return {
    url,
    checkedAt: new Date().toISOString(),
    responseMs,
    htmlBytes,
    findings,
  }
}
