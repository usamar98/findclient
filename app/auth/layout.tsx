import type { Metadata } from 'next'
import './auth.css'
export const metadata: Metadata = {
  title: 'Sign in | Lead To Client',
  robots: { index: false, follow: false },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
