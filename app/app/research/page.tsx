import Link from 'next/link'
import { keylessSources, researchSources } from '@/lib/live-research'
import { ResearchForm } from './research-form'
import './research.css'

export const metadata = { title: 'Live research | Lead To Client' }
export const maxDuration = 90

export default async function Research({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q, source } = await searchParams
  const requested = Array.isArray(source) ? source : [source]
  const selected = researchSources.filter(id => requested.includes(id))
  return <div className="live-research">
    <div className="work-title-row"><h1>Live research</h1><Link href="/app/inbox">Lead inbox</Link></div>
    <p>Find people asking for your service in public posts. Each result links to the author’s original request or discussion.</p>
    <ResearchForm initialQuery={typeof q === 'string' ? q.slice(0, 100) : ''} initialSources={selected.length ? selected : keylessSources} />
  </div>
}
