import Link from 'next/link'
import { headers } from 'next/headers'
import { keylessSources, paidSources, researchSources } from '@/lib/live-research'
import { isInboxNavigation } from '@/lib/inbox-filters'
import { parseResearchWindow } from '@/lib/research-windows'
import { ResearchForm } from './research-form'
import './research.css'

export const metadata = { title: 'Live research | Lead To Client' }
export const maxDuration = 90

export default async function Research({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q, source, mode, window, run } = await searchParams
  const requested = Array.isArray(source) ? source : [source]
  const selected = researchSources.filter(id => requested.includes(id))
  const initialSources = selected.length ? selected : mode === 'paid' ? paidSources : keylessSources
  const initialQuery = typeof q === 'string' ? q.slice(0, 100) : ''
  const initialWindow = parseResearchWindow(window, '15')
  const searchFromInbox = run === '1' && isInboxNavigation(await headers())
  return <div className="live-research">
    <div className="work-title-row"><h1>Live research</h1><Link href="/app/inbox">Lead inbox</Link></div>
    <p>Search public communities by keyword, or <Link href="/app/jobs">browse freelance jobs from the last 24 hours</Link>.</p>
    <ResearchForm key={JSON.stringify([initialQuery, initialWindow, initialSources])} initialQuery={initialQuery} initialWindow={initialWindow} initialSources={initialSources} searchFromInbox={searchFromInbox} />
  </div>
}
