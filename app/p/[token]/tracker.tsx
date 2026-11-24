'use client'
import { useEffect } from 'react'

export function OpenTracker({ token }: { token: string }) {
  useEffect(() => {
    let sent = false
    function record() {
      if (sent || document.visibilityState !== 'visible') return
      sent = true
      const key = 'proposal-visit-' + token
      let visit = crypto.randomUUID() as string
      try {
        visit = sessionStorage.getItem(key) || visit
        sessionStorage.setItem(key, visit)
      } catch { /* Session storage can be disabled in private browsers. */ }
      void fetch('/p/' + token + '/open', { method: 'POST', headers: { 'X-Proposal-Visit': visit }, keepalive: true }).catch(() => {})
    }
    record()
    document.addEventListener('visibilitychange', record)
    return () => document.removeEventListener('visibilitychange', record)
  }, [token])
  return null
}
