import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wordmark } from '@/components/wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { authConfigured, database } from '@/lib/db/server'
import { products } from '@/lib/payments'
import { signIn } from './actions'
import { AuthSubmit } from './auth-submit'

export type AccountQuery = { message?: string; purchase?: string }

export async function AccountPage({ mode, query }: { mode: 'login' | 'signup'; query: AccountQuery }) {
  const signup = mode === 'signup'
  const purchase = products.safeParse(query.purchase)
  if (query.purchase && !purchase.success) redirect('/pricing')
  const continuation = purchase.success ? '?purchase=' + purchase.data : ''
  if (authConfigured()) {
    const db = await database()
    const { data } = await db.auth.getUser()
    if (data.user) redirect(purchase.success ? '/app/checkout/' + purchase.data : '/app')
  }
  const hidden = <>
    <input type="hidden" name="mode" value={mode} />
    {purchase.success && <input type="hidden" name="purchase" value={purchase.data} />}
  </>
  return (
    <main className="auth-shell">
      <div className="auth-form-side">
        <header className="cf-auth-bar"><Wordmark /><ThemeToggle /></header>
        <div className="auth-content">
          <h1>{signup ? 'Create your account.' : 'Welcome back.'}</h1>
          <p>{signup ? 'Set up your lead inbox and choose the work you want to find.' : 'Sign in to review new leads and pick up your conversations.'}</p>
          {query.message && <div className="auth-message" role="status">{query.message.slice(0,180)}</div>}
          <form action={signIn}>
            {hidden}
            <input type="hidden" name="provider" value="google" />
            <AuthSubmit google />
          </form>
          <div className="auth-or">or use email</div>
          <form action={signIn}>
            {hidden}
            <input type="hidden" name="provider" value="email" />
            <label htmlFor="account-email">Email address</label>
            <input id="account-email" type="email" name="email" placeholder="you@example.com" required autoComplete="email" maxLength={254} />
            <AuthSubmit signup={signup} />
          </form>
          <p className="auth-hint">We’ll email you a secure link. No password needed.</p>
          <p className="auth-switch">{signup ? 'Already have an account? ' : 'New to Clientfind? '}
            <Link href={(signup ? '/auth/login' : '/auth/signup') + continuation}>{signup ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </div>
        <div className="auth-footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
      <aside className="auth-preview">
        <div className="auth-preview-inner">
          <div className="auth-preview-caption"><span>Lead inbox</span><span>Example</span></div>
          <div className="auth-lead">
            <div className="auth-lead-meta"><span>Shopify Community</span><b>92 / 100</b></div>
            <h2>Can someone fix our checkout before Friday?</h2>
            <p>Our mobile checkout stopped working after a theme update. Looking for a developer this week.</p>
            <div className="auth-lead-bottom"><span>Theme development</span><span>Deadline mentioned</span></div>
          </div>
        </div>
      </aside>
    </main>
  )
}
