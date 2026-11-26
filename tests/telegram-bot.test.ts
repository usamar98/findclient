import assert from 'node:assert/strict'
import test from 'node:test'
import type { ResearchResult } from '../lib/live-research'
import { readTelegramUpdate, telegramReply } from '../lib/telegram-bot'

const privateChat = { id: 42, type: 'private' }
const sender = { id: 42, is_bot: false }
function message(text: string, chat = privateChat, from = sender) {
  return readTelegramUpdate({ update_id: 100, message: { text, chat, from } }, 'LeadToClientBot')
}
const result: ResearchResult = {
  query: '', minutes: '1440', checkedAt: '2026-11-26T08:00:00.000Z',
  sources: [{ source: 'github', status: 'checked', count: 1, requests: 1, reviewed: 1, indexed: false }],
  posts: [{
    source: 'github', kind: 'hiring', engagement: 'paid_freelance', author: 'shopco', title: 'Implement <payments> & tests',
    url: 'https://github.com/shopco/shop/issues/42', posted_at: '2026-11-26T04:00:00-02:00', first_found_at: '2026-11-26T06:00:40Z', excerpt: '', compensation: '$250',
  }],
}
type Actions = Parameters<typeof telegramReply>[1]
function reply(text: string, overrides: Partial<Actions> = {}) {
  return telegramReply(message(text)!.command, {
    site: 'https://leadtoclient.app', account: async () => 'user-42', link: async () => 'linked',
    search: async query => ({ ...result, query }), setWatch: async () => {}, ...overrides,
  })
}

test('only private human messages and commands addressed to this bot are accepted', () => {
  assert.equal(message('/jobs', { id: -73, type: 'group' }), undefined)
  assert.equal(message('/jobs', privateChat, { id: 43, is_bot: false }), undefined)
  assert.equal(message('/jobs', privateChat, { id: 42, is_bot: true }), undefined)
  assert.equal(message('/search@AnotherBot Shopify'), undefined)
  assert.equal(readTelegramUpdate({ update_id: 100, edited_message: { text: '/watch SEO', chat: privateChat, from: sender } }), undefined)
  assert.equal(message('/jobs@leadtoclientbot')?.command.kind, 'jobs')
  assert.equal(readTelegramUpdate({ update_id: 7, message: { text: '/jobs@LeadToClientBot', chat: privateChat, from: sender } }, ' @LeadToClientBot ')?.command.kind, 'jobs')
  assert.equal(message('/start jobs')?.command.kind, 'jobs')
  assert.equal(message('/start alerts')?.command.kind, 'alerts')
  assert.equal(message('/start invalid')?.command.kind, 'expired')
})

test('a personal link is consumed without echoing the secret or declaring an expired code successful', async () => {
  const token = 'fe'.repeat(24)
  for (const status of ['linked', 'expired', 'conflict'] as const) {
    const response = await reply('/start ' + token, { link: async input => { assert.equal(input, token); return status } })
    assert.doesNotMatch(response.text, new RegExp(token))
    assert.match(response.text, { linked: /account is connected/, expired: /expired or was already used/, conflict: /different account/ }[status])
  }
  const consumed = await reply('/start ' + token, { link: async () => 'expired' })
  assert.match(consumed.text, /already has a connected workspace/)
})

test('unlinked chats can onboard without querying the paid feed or changing alerts', async () => {
  for (const cmd of ['/start jobs', 'Shopify', '/alerts', '/watch', '/unwatch']) {
    const response = await reply(cmd, {
      account: async () => null, search: async () => assert.fail('unlinked search'),
      setWatch: async () => assert.fail('unlinked account change'),
    })
    assert.match(response.text, /Connect my Telegram account/)
    assert.equal(response.buttons?.[0].url, 'https://leadtoclient.app/app/settings#telegram-alerts')
  }
})

test('jobs, plain keywords and /search share a bounded response with original job buttons and source times', async () => {
  for (const cmd of ['/jobs', '/search Web design', 'Web design']) {
    const query = cmd === '/jobs' ? '' : 'Web design'
    const response = await reply(cmd, { search: async q => {
      assert.equal(q, query)
      return { ...result, query: q, posts: Array.from({ length: 7 }, () => result.posts[0]) }
    } })
    assert.match(response.text, /past 24 hours/)
    assert.match(response.text, /Posted 2026-11-26 06:00:00 UTC\nFirst found 2026-11-26 06:00:40 UTC/)
    assert.match(response.text, /Listed pay · \$250/)
    assert.ok(response.buttons)
    assert.equal(response.buttons.length, 6)
    assert.equal(response.buttons[0].url, result.posts[0].url)
    assert.equal(new URL(response.buttons[5].url).searchParams.get('q') || '', query)
    assert.ok(response.text.length < 4096)
  }
  for (const cmd of ['/search', '/search s', 'x'.repeat(101)]) {
    const response = await reply(cmd, { search: async () => assert.fail('invalid search reached feed') })
    assert.match(response.text, /2 and 100/)
  }
  const invalidUrl = await reply('/jobs', { search: async () => ({
    ...result, posts: [{ ...result.posts[0], url: 'javascript:void(0)' }, { ...result.posts[0], url: 'https://user@example.com/job' }],
  }) })
  assert.deepEqual(invalidUrl.buttons?.map(button => button.url), ['https://leadtoclient.app/app/jobs'])
})

test('bot distinguishes rate limits, empty searches, partial coverage and unavailable feeds', async () => {
  assert.match((await reply('/jobs', { search: async () => null })).text, /search limit/)
  assert.match((await reply('/jobs', { search: async () => ({ ...result, posts: [] }) })).text, /No matching openings/)
  const unavailable = { ...result.sources[0], status: 'unavailable' as const }
  assert.match((await reply('/jobs', { search: async () => ({ ...result, posts: [], sources: [unavailable] }) })).text, /could not be checked/)
  assert.match((await reply('/jobs', { search: async () => ({ ...result, sources: [...result.sources, unavailable] }) })).text, /coverage was partial/)
})

test('Telegram identifies employer-listed contracts without a published rate', async () => {
  const response = await reply('/jobs', { search: async () => ({
    ...result,
    posts: [result.posts[0], {
      ...result.posts[0], source: 'weworkremotely', title: 'Contract web designer', url: 'https://weworkremotely.com/remote-jobs/example-contract',
      engagement: 'contract_pay_unlisted', compensation: undefined,
    }],
  }) })
  assert.match(response.text, /Paid gigs and employer-listed contracts from the past 24 hours/)
  assert.match(response.text, /2\. Contract web designer\nWe Work Remotely\nPosted [^\n]+\nFirst found [^\n]+\nContract · Pay not listed/)
  for (const cmd of ['/help', '/alerts', '/watch', '/watch Shopify']) {
    assert.match((await reply(cmd)).text, /paid gigs and employer-listed contracts/i)
  }
})

test('shared Hacker News and Bluesky job search links include independent posting and discovery times', async () => {
  const hn = { ...result.posts[0], source: 'hn' as const, url: 'https://news.ycombinator.com/item?id=42' }
  const bluesky = { ...result.posts[0], source: 'bluesky' as const, url: 'https://bsky.app/profile/buyer.bsky.social/post/test' }
  const response = await reply('/search payments', { search: async () => ({ ...result, posts: [hn, bluesky] }) })
  for (const source of ['Hacker News', 'Bluesky']) {
    assert.ok(response.text.includes(source + '\nPosted 2026-11-26 06:00:00 UTC\nFirst found 2026-11-26 06:00:40 UTC'))
  }
  assert.deepEqual(response.buttons?.slice(0, 2).map(button => button.url), [hn.url, bluesky.url])
})

test('watch and unwatch change only the linked owner with the requested keyword; failure is visible', async () => {
  const changes: (string | null)[] = []
  const setWatch = async (id: string, query: string | null) => { assert.equal(id, 'user-42'); changes.push(query) }
  for (const cmd of ['/watch Shopify', '/watch', '/unwatch']) await reply(cmd, { setWatch })
  assert.deepEqual(changes, ['Shopify', '', null])
  const failed = await reply('/watch design', { setWatch: async () => { throw new Error('DB unavailable') } })
  assert.match(failed.text, /could not change/)
})
