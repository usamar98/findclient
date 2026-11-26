import Link from 'next/link'
import { redirect } from 'next/navigation'
import { telegramStartUrl } from '@/lib/telegram-entry'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Telegram job alerts | Lead To Client',
  robots: { index: false, follow: true },
}

export default function TelegramEntry() {
  const destination = telegramStartUrl('jobs')
  if (destination) redirect(destination)

  return <main className="mk-article">
    <h1>Telegram job alerts</h1>
    <p>Telegram setup is pending. You can browse freelance openings from the past 24 hours in your workspace now.</p>
    <p><Link href="/app/jobs" className="mk-btn">Browse jobs from the past 24 hours</Link></p>
  </main>
}
