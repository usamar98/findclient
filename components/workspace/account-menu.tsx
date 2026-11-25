'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActionState, useEffect, useRef } from 'react'
import { signOut } from '@/app/auth/actions'
import './account-menu.css'

const links = [
  { href: '/app/profile', label: 'Profile' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/app/settings', label: 'Settings' },
]

export function AccountMenu({ onOpen }: { onOpen?: () => void }) {
  const pathname = usePathname()
  const menu = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const [message, submitSignOut, signingOut] = useActionState(signOut, '')

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  return (
    <details ref={menu} className="cf-account-menu"
      onToggle={event => { if (event.currentTarget.open) onOpen?.() }}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.stopPropagation()
          event.currentTarget.open = false
          trigger.current?.focus()
        }
      }}
    >
      <summary ref={trigger}>
        Account
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <div className="cf-account-panel">
        {links.map(link => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}
            onClick={() => { if (menu.current) menu.current.open = false }}>
            {link.label}
          </Link>
        ))}
        <form action={submitSignOut}>
          <button type="submit" disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          {message && <p className="cf-account-status" role="status">{message}</p>}
        </form>
      </div>
    </details>
  )
}
