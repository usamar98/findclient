import type { Metadata } from 'next'
import Link from 'next/link'
import { Wordmark } from '@/components/wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { requireUser } from '@/lib/db/server'
import { signOut } from '../auth/actions'
export const metadata: Metadata = {
  title: 'Workspace | Clientfind',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'
export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()
  return (
    <div className="workspace">
      <header>
        <Wordmark href="/app" />
        <nav aria-label="Workspace">
          <Link href="/app">Lead inbox</Link>
          <Link href="/app/settings">Settings</Link>
          <Link href="/pricing">Pricing</Link>
          <ThemeToggle />
          <form action={signOut}>
            <button>Sign out</button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
