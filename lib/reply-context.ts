import type { SiteReport } from './site-audit/analyze'

export type ReplyContext = {
  writingExamples: string[]
  website: Pick<SiteReport, 'url' | 'findings'> | null
}
export function replyContext(
  pasted: string,
  edits: string[],
  site: SiteReport | null,
): ReplyContext {
  const writingExamples = [
    ...new Set([pasted, ...edits].map((v) => v.trim()).filter(Boolean)),
  ]
    .slice(0, 4)
    .map((v) => v.slice(0, 420))
  return {
    writingExamples,
    website: site
      ? { url: site.url, findings: site.findings.slice(0, 3) }
      : null,
  }
}
