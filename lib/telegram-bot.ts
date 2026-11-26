import { z } from 'zod'
import { researchSourceLabels, type ResearchResult } from './live-research'

const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z.object({
    text: z.string().max(4096).optional(),
    chat: z.object({ id: z.number().int(), type: z.string() }),
    from: z.object({ id: z.number().int(), is_bot: z.boolean() }).optional(),
  }).optional(),
})

type Command =
  | { kind: 'help' | 'alerts' | 'unwatch' | 'usage' | 'expired' }
  | { kind: 'link'; token: string }
  | { kind: 'jobs' | 'watch'; query: string }

function parseCommand(text: string, username?: string): Command | undefined {
  if (!text.startsWith('/')) return validQuery(text) ? { kind: 'jobs', query: text } : { kind: 'usage' }
  const match = /^\/(\w+)(?:@(\w+))?(?:\s+([\s\S]*))?$/.exec(text)
  if (!match) return { kind: 'usage' }
  if (match[2] && match[2].toLowerCase() !== username?.trim().replace(/^@/, '').toLowerCase()) return
  const value = (match[3] || '').trim()
  const name = match[1].toLowerCase()
  switch (name) {
    case 'start':
      if (/^[0-9a-f]{48}$/.test(value)) return { kind: 'link', token: value }
      if (value === 'jobs') return { kind: 'jobs', query: '' }
      if (value === 'alerts') return { kind: 'alerts' }
      return { kind: value ? 'expired' : 'help' }
    case 'help': return { kind: 'help' }
    case 'alerts': return { kind: 'alerts' }
    case 'unwatch': return { kind: 'unwatch' }
    case 'search': return validQuery(value) ? { kind: 'jobs', query: value } : { kind: 'usage' }
    case 'jobs':
    case 'watch':
      return (!value || validQuery(value)) ? { kind: name, query: value } : { kind: 'usage' }
    default: return { kind: 'usage' }
  }
}

const validQuery = (query: string) => query.length >= 2 && query.length <= 100

export function readTelegramUpdate(input: unknown, username?: string) {
  const update = updateSchema.safeParse(input)
  if (!update.success) return
  const message = update.data.message
  if (message?.chat.type !== 'private' || message.from?.is_bot !== false ||
      message.chat.id <= 0 || message.from.id !== message.chat.id || !message.text?.trim()) return
  const command = parseCommand(message.text.trim(), username)
  if (command) return { updateId: update.data.update_id, chatId: String(message.chat.id), command }
}

type Button = { text: string; url: string }
export type BotReply = { text: string; buttons?: Button[] }

type BotActions = {
  site: string
  link: (token: string) => Promise<'linked' | 'expired' | 'conflict'>
  account: () => Promise<string | null>
  search: (query: string) => Promise<ResearchResult | null>
  setWatch: (owner: string, query: string | null) => Promise<void>
}

const usage = 'Send /jobs for paid gigs and employer-listed contracts from the past 24 hours. Type a skill or use /search shopify to filter them. Send /watch shopify for new matches, /watch for all openings, or /unwatch to stop job alerts. Send /alerts for alert settings.'

function shortText(value: string, max: number) {
  return value.replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim().slice(0, max)
}

function formatJobs(result: ResearchResult, site: string): BotReply {
  const page = new URL('/app/jobs', site)
  if (result.query) page.searchParams.set('q', result.query)
  const buttons: Button[] = []
  const lines: string[] = []
  for (const post of result.posts.slice(0, 5)) {
    const url = URL.canParse(post.url) ? new URL(post.url) : null
    if (!url || url.protocol !== 'https:' || url.username || url.password) continue
    const date = new Date(post.posted_at).toISOString().slice(0, 16).replace('T', ' ')
    const source = researchSourceLabels[post.source]
    const n = buttons.length + 1
    const pay = post.engagement === 'contract_pay_unlisted'
      ? 'Contract · Pay not listed'
      : post.compensation && 'Listed pay · ' + shortText(post.compensation, 70)
    lines.push([n + '. ' + shortText(post.title, 160), source + ' · ' + date + ' UTC', pay].filter(Boolean).join('\n'))
    buttons.push({ text: n + ' · Open on ' + source, url: url.href })
  }
  const checked = result.sources.filter(source => source.status === 'checked').length
  const heading = 'Paid gigs and employer-listed contracts from the past 24 hours' + (result.query ? ' matching “' + shortText(result.query, 100) + '”' : '')
  const summary = checked
    ? 'No matching openings were found in the sources checked.'
    : 'The sources could not be checked. Try again later.'
  if (checked && result.sources.some(source => source.partial || source.status !== 'checked')) {
    lines.push('Source coverage was partial.')
  }
  return {
    text: [heading, ...(!buttons.length ? [summary] : []), ...lines].join('\n\n'),
    buttons: [...buttons, { text: 'View all results and source status', url: page.href }],
  }
}

export async function telegramReply(command: Command, actions: BotActions): Promise<BotReply> {
  const settings = { text: 'Open Telegram settings', url: new URL('/app/settings#telegram-alerts', actions.site).href }
  const connect = 'Sign in to Lead To Client and select “Connect my Telegram account” in Settings. Start the bot from that one-time link. Then type /jobs or a skill here.'
  if (command.kind === 'link') {
    const result = await actions.link(command.token)
    if (result === 'linked') return { text: 'Your Telegram account is connected to Lead To Client. ' + usage }
    if (result === 'conflict') return { text: 'This chat is already linked to a different account. Disconnect it from that account’s Telegram settings before linking another.', buttons: [settings] }
    if (await actions.account()) return { text: 'This link expired or was already used. This chat already has a connected workspace. Send /jobs to see its job feed.', buttons: [settings] }
    return { text: 'This connection link expired or was already used. For a new link, open Telegram settings.', buttons: [settings] }
  }
  if (command.kind === 'expired') return { text: 'This start link is invalid. ' + connect, buttons: [settings] }
  if (command.kind === 'help' || command.kind === 'usage') return {
    text: (command.kind === 'help' ? 'Welcome to Lead To Client. ' : 'Use a search term between 2 and 100 characters. ') + usage,
    buttons: [settings],
  }
  const owner = await actions.account()
  if (!owner) return { text: connect, buttons: [settings] }
  if (command.kind === 'alerts') return {
    text: 'Job alerts cover paid gigs and employer-listed contracts. Send /watch shopify for new matches or /watch for all openings. Use /unwatch to stop these updates. Manage priority lead alerts in workspace settings and Automations.',
    buttons: [settings, { text: 'Manage automations', url: new URL('/app/automations', actions.site).href }],
  }
  if (command.kind === 'watch' || command.kind === 'unwatch') {
    const query = command.kind === 'watch' ? command.query : null
    try {
      await actions.setWatch(owner, query)
    } catch {
      return { text: 'I could not change your job alerts. Check that this chat is still connected and try again shortly.', buttons: [settings] }
    }
    return { text: query === null ? 'Job alerts are off. You can still use /jobs and /search.' :
      'Watching for new paid gigs and employer-listed contracts' + (query ? ' matching “' + shortText(query, 100) + '”' : '') + '. Use /unwatch to stop.' }
  }
  if (command.kind !== 'jobs') return { text: usage }
  const result = await actions.search(command.query)
  if (!result) return { text: 'You have reached the Telegram job search limit. Try again in a few minutes.' }
  return formatJobs(result, actions.site)
}
