import 'server-only'
import { database } from './db/server'
import type { ScanRun, ScanSourceReceipt } from './db/schema'
import { isPendingScanState } from './scan-outcomes'

export type Receipt = ScanRun & { sources: ScanSourceReceipt[] }

export async function readScanReceipts(ownerId: string, limit: number): Promise<Receipt[]> {
  const db = await database()
  const { data: runs, error } = await db.from('scan_runs').select('*')
    .eq('user_id', ownerId).order('started_at', { ascending: false }).limit(limit)
  if (error || !runs?.length) return []
  const { data, error: detailError } = await db.from('scan_run_sources').select('*')
    .in('run_id', runs.map(run => run.id)).order('source')
  if (detailError) return []
  return runs.map(run => ({ ...run, sources: data.filter(source => source.run_id === run.id) }))
}

export function scanTotals(run: Receipt) {
  return run.sources.reduce((total, item) => ({
    found: total.found + item.found, scored: total.scored + item.scored,
    matched: total.matched + item.matched, spent: total.spent + item.spent,
    local: total.local + (item.local_scored ?? 0),
    drafted: total.drafted + (item.drafted ?? 0), skipped: total.skipped + (item.draft_skipped ?? 0),
  }), { found: 0, scored: 0, matched: 0, spent: 0, local: 0, drafted: 0, skipped: 0 })
}

export function sourceState(run: Receipt, source: ScanSourceReceipt) {
  const expired = Date.now() - Date.parse(run.started_at) >= 6 * 3600000
  return expired && isPendingScanState(source.state) ? 'expired' : source.state
}
export function scanPending(run: Receipt) {
  return run.sources.some(s => isPendingScanState(sourceState(run, s)))
}
