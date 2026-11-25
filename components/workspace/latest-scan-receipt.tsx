import Link from 'next/link'
import { readScanReceipts, scanPending, scanTotals } from '@/lib/scan-receipts'

export async function LatestScanReceipt({ ownerId }: { ownerId: string }) {
  const [run] = await readScanReceipts(ownerId, 1)
  if (!run) return null
  const total = scanTotals(run)
  return <section className="panel" aria-label="Latest scan receipt">
    <h2>{scanPending(run) ? 'Scan in progress' : 'Last scan'} · {run.service}</h2>
    <p>{total.found} posts found → {total.scored} scored → {total.matched} matched · {total.spent} credits used{run.credit_limit !== null && ` of ${run.credit_limit} allowed`}</p>
    {total.drafted > 0 && <p>{total.scored} scoring credits · {total.drafted} automatic reply credits</p>}
    {total.skipped > 0 && <p>{total.skipped} automatic {total.skipped === 1 ? 'draft' : 'drafts'} skipped at the credit cap</p>}
    <Link href="/app/scans">View scan receipts</Link>
  </section>
}
