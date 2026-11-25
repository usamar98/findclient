import type { Metadata } from 'next'
import { Wordmark } from '@/components/wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { WorkspaceNav } from '@/components/workspace/workspace-nav'
import { AccountMenu } from '@/components/workspace/account-menu'
import { requireUser } from '@/lib/db/server'
export const metadata: Metadata = {
  title: 'Workspace | Lead To Client',
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
      <header className="work-header">
        <Wordmark href="/app" />
        <WorkspaceNav />
        <div className="work-account">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
