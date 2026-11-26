import 'server-only'

export function telegramStartUrl(payload: string) {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '')
  if (!username || !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)
    || !process.env.TELEGRAM_BOT_TOKEN?.trim() || !process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) return null
  return 'https://t.me/' + username + '?start=' + encodeURIComponent(payload)
}
