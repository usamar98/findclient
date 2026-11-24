'use client'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LIFETIME_ENDS_AT, lifetimeLastDay } from '@/lib/offers'

const deadline = Date.parse(LIFETIME_ENDS_AT)

export function LifetimeCheckout({ initialTime, available, children }: { initialTime: number; available: boolean; children: ReactNode }) {
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
    <div className="cf-lifetime-buy" data-expired={expired}>
      {expired ? <p className="cf-clock-note">The lifetime deal ended on {lifetimeLastDay}.</p> : (
        <div className="cf-lifetime-clock">
          <p className="cf-clock-heading">Offer ends <time dateTime={LIFETIME_ENDS_AT}>{lifetimeLastDay}</time></p>
          <div className="cf-time-tiles" role="timer" aria-live="off" aria-label="Time remaining for the lifetime deal">
            {units.map(({ value, label }) => <span key={label}><b>{String(value).padStart(2, '0')}</b><small>{label === 'hrs' ? 'hours' : label}</small></span>)}
          </div>
          <p>Available through 11:59 PM Pakistan time.</p>
        </div>
      )}
      {children}
      <form action="/api/checkout" method="post">
        <input type="hidden" name="product" value="lifetime" />
        <button disabled={expired || !available}>
          {expired ? 'Deal closed' : available ? 'Get lifetime access' : 'Currently unavailable'}
        </button>
      </form>
    </div>
  )
}
