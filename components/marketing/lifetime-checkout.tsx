'use client'
import { useEffect, useState } from 'react'
import { LIFETIME_ENDS_AT } from '@/lib/offers'

const deadline = Date.parse(LIFETIME_ENDS_AT)

export function LifetimeCheckout({ initialTime, available }: { initialTime: number; available: boolean }) {
  const [now, setNow] = useState(initialTime)
  useEffect(() => {
    setNow(Date.now())
    if (Date.now() >= deadline) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= deadline) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))
  const expired = remaining === 0
  const units = [
    { value: Math.floor(remaining / 86400), label: 'days' },
    { value: Math.floor(remaining / 3600) % 24, label: 'hrs' },
    { value: Math.floor(remaining / 60) % 60, label: 'min' },
    { value: remaining % 60, label: 'sec' },
  ]
  return (
    <div className="cf-plan-bottom">
      {expired ? <p className="cf-clock-note">Offer ended December 26, 2026.</p> : (
        <div className="cf-deal-clock">
          <p className="cf-clock-note">Ends <time dateTime={LIFETIME_ENDS_AT}>Dec 26, 2026 · 11:59 pm PKT</time></p>
          <div className="cf-countdown" role="timer" aria-live="off" aria-label="Time remaining for the lifetime deal">
            {units.map(({ value, label }) => (
              <span key={label}><b>{String(value).padStart(2, '0')}</b> {label}</span>
            ))}
          </div>
        </div>
      )}
      <form action="/api/checkout" method="post">
        <input type="hidden" name="product" value="lifetime" />
        <button className="cf-plan-action" disabled={expired || !available}>
          {expired ? 'Deal closed' : available ? 'Get lifetime deal' : 'Currently unavailable'}<span aria-hidden="true">↗</span>
        </button>
      </form>
    </div>
  )
}
