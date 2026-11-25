import Link from 'next/link'
import { Wordmark } from '@/components/wordmark'
export default function NotFound() {
  return (
    <div className="workspace">
      <main>
        <Wordmark />
        <h1>Page not found</h1>
        <p>
          This link may have changed. You can return to your inbox or browse the
          guides.
        </p>
        <nav aria-label="Available pages">
          <Link href="/">Home</Link>
          <Link href="/app/inbox">Lead inbox</Link>
          <Link href="/blog">Freelance guides</Link>
        </nav>
      </main>
    </div>
  )
}
