'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Wordmark } from '@/components/wordmark'

const pages = [
  ['/how-it-works', 'How it works'],
  ['/blog', 'Journal'],
  ['/pricing', 'Pricing'],
] as const

export function Navigation() {
  const pathname = usePathname()
  const [compact, setCompact] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const header = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
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
        <Wordmark />
        <nav id="cf-primary" className="cf-primary" aria-label="Main navigation" data-open={menuOpen}>
          {pages.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
          <Link className="cf-menu-login" href="/auth/login">Sign in</Link>
        </nav>
        <div className="cf-account">
          <Link className="cf-login" href="/auth/login">Sign in</Link>
          <Link className="cf-register" href="/auth/signup">Get started</Link>
          <button ref={menuButton} type="button" className="cf-menu-button" aria-controls="cf-primary" aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span />
          </button>
        </div>
      </div>
    </header>
  )
}
