'use client'
import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { continueScan, saveBudget, startScan } from '@/app/app/scans/actions'

export function ContinueScan({ id }: { id: string }) {
  const [message, submit, pending] = useActionState(continueScan, '')
  return <form action={submit}>
    <input type="hidden" name="run" value={id} />
    <button type="submit" disabled={pending}>{pending ? 'Checking…' : 'Continue this scan'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}

export function ScanNowForm({ searches }: { searches: { id: string; skill: string; active: boolean }[] }) {
  const [message, submit, pending] = useActionState(startScan, '')
  const [request, setRequest] = useState('')
  useEffect(() => { setRequest(crypto.randomUUID()) }, [])
  return <form action={form => { submit(form); setRequest(crypto.randomUUID()) }} className="scan-form">
    <label>Saved search<select required name="niche">{searches.map(search =>
      <option key={search.id} value={search.id}>{search.skill}{search.active ? '' : ' (schedule off)'}</option>)}</select></label>
    <label>Maximum credits for this scan<input type="number" name="cap" min={1} max={2147483647} step={1} defaultValue={5} required /></label>
    <input type="hidden" name="request" value={request} />
    <button disabled={pending || !request}>{pending ? 'Starting scan…' : 'Scan now'}</button>
    {message && <span role="status">{message}</span>}
  </form>
}

export function BudgetForm({ niche, amount, label }: { niche?: string; amount: number | null; label: string }) {
  const [message, submit, pending] = useActionState(saveBudget, '')
  return <form action={submit} className="scan-form">
    {niche && <input type="hidden" name="niche" value={niche} />}
    <label>{label}<input type="number" name="amount" min={0} max={2147483647} step={1} required={!niche}
      defaultValue={amount ?? ''} placeholder={niche ? 'No limit' : undefined} /></label>
    <button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    {message && <span role="status">{message}</span>}
  </form>
}

export function RefreshScanReceipts({ active }: { active: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => { if (!document.hidden) router.refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [active, router])
  return <button type="button" onClick={() => router.refresh()}>Refresh receipts</button>
}
