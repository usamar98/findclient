import Link from 'next/link'
import { researchSources } from '@/lib/live-research'
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
    <p>Search recent public posts by their original publication time. Open a post to read the conversation before reaching out.</p>
    <ResearchForm initialQuery={typeof q === 'string' ? q.slice(0, 100) : ''} initialSources={selected.length ? selected : researchSources} />
  </div>
}
