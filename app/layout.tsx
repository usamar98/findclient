import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { siteOrigin } from '@/lib/origin'
import './globals.css'

export const metadata: Metadata = { metadataBase: new URL(siteOrigin()) }

const geist = localFont({
  src: '../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2',
  weight: '100 900',
  display: 'optional',
  fallback: ['Arial', 'sans-serif'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.className}>
      <body>{children}</body>
    </html>
  )
}
