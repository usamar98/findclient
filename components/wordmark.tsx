import Link from 'next/link'
import { BrandMark } from './brand-mark'

export function Wordmark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="cf-wordmark" aria-label={href === '/app' ? 'Lead To Client workspace' : 'Lead To Client home'}>
      <span className="cf-symbol"><BrandMark /></span>
      Lead To Client
    </Link>
  )
}
