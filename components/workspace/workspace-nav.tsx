'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const destinations = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/inbox', label: 'Inbox' },
  { href: '/app/scans', label: 'Scans' },
  { href: '/app/automations', label: 'Automations' },
  { href: '/app/results', label: 'Results' },
]

export function WorkspaceNav() {
  const path = usePathname()
  return (
    <nav className="work-nav" aria-label="Workspace">
      {destinations.map(({ href, label }) => (
        <Link href={href} key={href} aria-current={path === href || (href === '/app/inbox' && path.startsWith('/app/leads/')) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
