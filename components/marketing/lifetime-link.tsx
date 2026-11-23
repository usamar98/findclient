'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LIFETIME_ENDS_AT } from '@/lib/offers'

const deadline = Date.parse(LIFETIME_ENDS_AT)

export function LifetimeLink({ className, children }: { className: string; children?: ReactNode }) {
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    let timer: number | undefined
    function checkOffer() {
      const remaining = deadline - Date.now()
      setEnded(remaining <= 0)
      // Browser timers only accept delays up to a signed 32-bit integer.
      if (remaining > 0) timer = window.setTimeout(checkOffer, Math.min(remaining, 2_147_483_647))
    }
    checkOffer()
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Link className={className} href={ended ? '/pricing' : '/pricing#lifetime-deal'}>
      {ended ? 'View pricing' : 'Get lifetime access'}{children}
    </Link>
  )
}
