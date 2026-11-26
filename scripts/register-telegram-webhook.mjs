const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
const url = 'https://leadtoclient.app/api/telegram/webhook'

async function call(method, body) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error('Telegram rejected ' + method + ' (HTTP ' + response.status + ').')
  return data.result
}

try {
  if (!token || !/^[A-Za-z0-9_-]{1,256}$/.test(secret ?? '')) {
    throw new Error('Set TELEGRAM_BOT_TOKEN and a valid TELEGRAM_WEBHOOK_SECRET before registering.')
  }
  await call('setWebhook', { url, secret_token: secret, allowed_updates: ['message'] })
  const info = await call('getWebhookInfo', {})
  if (info.url !== url) throw new Error('Telegram returned a different webhook URL.')
  console.log('Telegram webhook registered at ' + url)
} catch (error) {
  // Avoid exposing request URLs containing the bot token in network exceptions.
  console.error(error instanceof Error ? error.message.replaceAll(token || '\u0000', '[redacted]') : 'Telegram webhook setup failed.')
  process.exitCode = 1
}
