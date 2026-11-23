import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="workspace">
      <main>
        <Link className="brand" href="/">
          Clientfind
        </Link>
        <h1>Page not found</h1>
        <p>
          This link may have changed. You can return to your inbox or browse the
          guides.
        </p>
        <nav aria-label="Available pages">
          <Link href="/">Home</Link>
          <Link href="/app">Lead inbox</Link>
          <Link href="/blog">Freelance guides</Link>
        </nav>
      </main>
    </div>
  )
}
