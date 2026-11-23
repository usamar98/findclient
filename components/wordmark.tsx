import Link from 'next/link'

export function Wordmark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="cf-wordmark" aria-label="Clientfind home">
      <span className="cf-symbol" aria-hidden="true"><i /><i /><i /></span>
      Clientfind
    </Link>
  )
}
