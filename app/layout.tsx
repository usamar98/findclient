import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { siteConfig } from '@/lib/seo'
import { themeBootstrap } from '@/lib/theme'
import './globals.css'
import './workspace-theme.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
}

const geist = localFont({
  src: '../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2',
  weight: '100 900',
  display: 'optional',
  fallback: ['Arial', 'sans-serif'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script
          defer
          src="https://www.ship-or-die.com/hackathon/verify.js"
          data-site="bfdec9787f8631124eebba84c2f2260f207e9b16"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
