import 'server-only'

export class TelegramDeliveryError extends Error {
  constructor(readonly status: number) {
    super('Telegram delivery failed')
  }
}

export async function sendTelegramText(chatId: string, text: string, buttons?: { text: string; url: string }[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Telegram is not configured')
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text, link_preview_options: { is_disabled: true },
      ...(buttons?.length && { reply_markup: { inline_keyboard: buttons.map(button => [button]) } }),
    }),
  })
  if (!response.ok) throw new TelegramDeliveryError(response.status)
}
