import { absolute } from './seo'
import { contentUpdated, publicPages } from './public-pages'
import { posts } from './posts'
import { getOffers } from './pricing'
import { LIFETIME_ENDS_AT } from './offers'
import { niches } from './niche-content'
export async function llmsDocument(full: boolean) {
  const offers = await getOffers()
  const lifetime = offers.find((o) => o.product === 'lifetime')!
  const lifetimeOpen = Date.now() < Date.parse(LIFETIME_ENDS_AT)
  const intro = [
    '# Clientfind',
    '',
    '> Clientfind helps freelancers and small agencies find public requests for their skills and write a useful first reply.',
    '',
    'Last updated ' + contentUpdated + '.',
    '',
    '## Product',
    '',
    'Clientfind scans recent public requests. Fast discovery checks Hacker News, Bluesky and Shopify Community every ten minutes when enabled. Other sources use hourly searches. Teams qualify leads using source evidence, audit linked websites, draft replies in their voice and track proposals and won revenue.',
    '',
    'Supported sources include Hacker News, Bluesky, Stack Exchange, Shopify Community and indexed public conversations from Reddit, Indie Hackers, X and forums. Coverage depends on source availability, search indexing and configured providers.',
    '',
    '## Lifetime access and credits',
    '',
    '- Scoring a post or generating a response uses one credit.',
    lifetimeOpen
      ? `- Lifetime starts at $149 and increases by $10 after each 10 deals. The one-time purchase includes ${lifetime.credits} credits per month and three service searches. The offer ends December 26, 2026 at 11:59 pm Pakistan time.`
      : '- The lifetime offer ended on December 26, 2026.',
    ...offers
      .filter((o) => o.product.startsWith('topup') && o.price !== null)
      .map(
        (o) => '- Credit pack: ' + o.credits + ' credits for $' + o.price + '.',
      ),
    '',
    '## Pages',
    '',
    ...publicPages().map(
      (p) => '- [' + p.title + '](' + absolute(p.path) + ')',
    ),
    '',
    '## Guides in Markdown',
    '',
    ...posts().map(
      (p) =>
        '- [' + p.title + '](' + absolute('/guides/' + p.slug + '.md') + ')',
    ),
  ]
  if (full) {
    intro.push('', '## Niche playbooks', '')
    for (const n of niches)
      intro.push(
        '### ' + n.title,
        '',
        n.quickAnswer,
        '',
        ...n.where.map((s) => '- ' + s),
        '',
        n.approach,
        '',
      )
    for (const p of posts())
      intro.push(
        '# ' + p.title,
        '',
        'By ' + p.author + '. Updated ' + p.updated + '.',
        '',
        'Quick answer: ' + p.quickAnswer,
        '',
        p.body.trim(),
        '',
      )
  }
  return intro.join('\n') + '\n'
}
