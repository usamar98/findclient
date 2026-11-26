import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { telegramStartUrl } from '@/lib/telegram-entry'
import './telegram-job-card.css'

export function TelegramJobCard({ children }: { children?: ReactNode }) {
  const configured = Boolean(telegramStartUrl('jobs'))
  return <section className="telegram-jobs-card" id="telegram" aria-labelledby="telegram-jobs-title">
    <div className="telegram-jobs-copy">
      <h2 id="telegram-jobs-title">Find freelance jobs in Telegram</h2>
      {configured ? (
        <p>Connect your workspace once. In Telegram, send <code>/search shopify</code> for freelance jobs from the past 24 hours or <code>/watch shopify</code> to receive new matches.</p>
      ) : (
        <p>Telegram setup is pending. Browse freelance jobs in your workspace while the bot is being connected.</p>
      )}
      <div className="telegram-jobs-actions">
        {configured ? (
          <Link href="/telegram" prefetch={false} className="telegram-jobs-button">Open Telegram</Link>
        ) : (
          <Link href="/app/jobs" className="telegram-jobs-button">Browse 24-hour jobs</Link>
        )}
        {configured && children}
      </div>
    </div>
    <Link className="telegram-jobs-code" href="/telegram" prefetch={false} aria-label={configured ? 'Open the Telegram bot' : 'View Telegram setup status'}>
      <Image src="/telegram-jobs-qr.png" alt="" width={164} height={164} unoptimized />
      <span>{configured ? 'Scan to open Telegram' : 'View Telegram setup status'}</span>
    </Link>
  </section>
}
