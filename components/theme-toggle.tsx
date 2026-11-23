'use client'

import { themeStorageKey } from '@/lib/theme'

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = theme
    try {
      localStorage.setItem(themeStorageKey, theme)
    } catch {
      // The selection still applies to this page if storage is disabled.
    }
  }

  return (
    <button type="button" className="cf-theme-toggle" onClick={toggle}>
      <span className="cf-theme-light">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <span className="sr-only">Switch to dark mode</span>
      </span>
      <span className="cf-theme-dark">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M20.7 14.9A9.1 9.1 0 0 1 9.1 3.3a9.15 9.15 0 1 0 11.6 11.6Z" />
        </svg>
        <span className="sr-only">Switch to light mode</span>
      </span>
    </button>
  )
}
