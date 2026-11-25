'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Wordmark } from '@/components/wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountMenu } from '@/components/workspace/account-menu'

const pages = [
  ['/how-it-works', 'How it works'],
  ['/blog', 'Journal'],
  ['/pricing', 'Pricing'],
] as const

export function Navigation() {
  const pathname = usePathname()
  const [compact, setCompact] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const header = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const cookieEvents = 'cookieStore' in window && window.cookieStore instanceof EventTarget ? window.cookieStore : null
    let pending: AbortController | undefined
    const syncAccount = () => {
      if (document.hidden) return
      pending?.abort()
      // Supabase SSR stores its auth cookie in chunks for larger sessions.
      if (!/(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie)) {
        setSignedIn(false)
        return
      }
      const controller = new AbortController()
      pending = controller
      fetch('/auth/home', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal })
        .then(response => response.ok ? response.json() : null)
        .then((result: { signedIn: boolean } | null) => {
          if (!controller.signal.aborted) setSignedIn(result?.signedIn ?? null)
        })
        .catch(() => { if (!controller.signal.aborted) setSignedIn(null) })
    }
    syncAccount()
    document.addEventListener('visibilitychange', syncAccount)
    window.addEventListener('pageshow', syncAccount)
    cookieEvents?.addEventListener('change', syncAccount)
    return () => {
      pending?.abort()
      document.removeEventListener('visibilitychange', syncAccount)
      window.removeEventListener('pageshow', syncAccount)
      cookieEvents?.removeEventListener('change', syncAccount)
    }
  }, [pathname])
  useEffect(() => {
    const update = () => setCompact(window.scrollY > 48)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [menuOpen])
  return (
    <header ref={header} className="cf-mast" data-compact={compact} onKeyDown={e => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }} onBlur={e => {
      if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false)
    }} onClick={e => {
      if ((e.target as Element).closest('a')) setMenuOpen(false)
    }}>
      <div className="cf-bar">
        <Wordmark href={signedIn === null ? '/auth/home' : signedIn ? '/app' : '/'} />
        <nav id="cf-primary" className="cf-primary" aria-label="Main navigation" data-open={menuOpen}>
          {pages.filter(([href]) => !(signedIn && href === '/pricing')).map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
          {signedIn === false && <Link className="cf-menu-login" href="/auth/login">Sign in</Link>}
        </nav>
        <div className="cf-account">
          <ThemeToggle />
          {signedIn ? <AccountMenu onOpen={() => setMenuOpen(false)} /> : signedIn === false ? <>
            <Link className="cf-login" href="/auth/login">Sign in</Link>
            <Link className="cf-register" href="/auth/signup">Get started</Link>
          </> : <Link className="cf-register" href="/auth/login">Account</Link>}
          <button ref={menuButton} type="button" className="cf-menu-button" aria-controls="cf-primary" aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span />
          </button>
        </div>
      </div>
    </header>
  )
}
