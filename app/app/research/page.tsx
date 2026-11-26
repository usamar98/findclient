import Link from 'next/link'
import { keylessSources, paidSources, researchSources, researchWindows, type ResearchWindow } from '@/lib/live-research'
import { ResearchForm } from './research-form'
import './research.css'

export const metadata = { title: 'Live research | Lead To Client' }
export const maxDuration = 90

export default async function Research({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q, source, mode, window } = await searchParams
  const requested = Array.isArray(source) ? source : [source]
  const selected = researchSources.filter(id => requested.includes(id))
  const initialSources = selected.length ? selected : mode === 'paid' ? paidSources : keylessSources
  const initialQuery = typeof q === 'string' ? q.slice(0, 100) : ''
  const initialWindow = typeof window === 'string' && Object.hasOwn(researchWindows, window) ? window as ResearchWindow : '15'
  return <div className="live-research">
    <div className="work-title-row"><h1>Live research</h1><Link href="/app/inbox">Lead inbox</Link></div>
    <p>Find paid freelance jobs and people asking for help in public communities. Open a result to read the original post.</p>
    <ResearchForm key={JSON.stringify([initialQuery, initialWindow, initialSources])} initialQuery={initialQuery} initialWindow={initialWindow} initialSources={initialSources} />
  </div>
}
