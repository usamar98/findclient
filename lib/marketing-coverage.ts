// Public descriptions of the source adapters and workspace scan schedule.
export const sourceCoverage = [
  {
    sources: 'Hacker News',
    method:
      'Ask HN stories and comments through Algolia. You can watch comments in specific threads.',
    fast: true,
    reference: 'Hacker News search API',
    url: 'https://hn.algolia.com/api',
  },
  {
    sources: 'Bluesky',
    method: 'Public posts matching the search terms, requested newest first.',
    fast: true,
    reference: 'Bluesky search endpoint',
    url: 'https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/searchPosts.json',
  },
  {
    sources: 'Shopify Community',
    method: 'Recent public topics in the community feed, filtered by keyword.',
    fast: true,
    reference: 'Shopify Community feed',
    url: 'https://community.shopify.com/latest.rss',
  },
  {
    sources: 'Stack Overflow',
    method:
      'Open questions matching the search terms through the Stack Exchange API.',
    fast: false,
    reference: 'Stack Exchange advanced search',
    url: 'https://api.stackexchange.com/docs/advanced-search',
  },
  {
    sources: 'Reddit, X, Indie Hackers and selected public forums',
    method:
      'Public posts indexed by Exa. Reddit searches can be restricted to specific communities. Forum coverage includes Webflow, Bubble and WordPress support.',
    fast: false,
    reference: 'Exa search documentation',
    url: 'https://docs.exa.ai/reference/search',
  },
] as const

export const coverageIntro =
  'With Fast Discovery enabled, active saved searches with credits check Hacker News, Bluesky and Shopify Community every ten minutes. Other selected community sources follow an hourly schedule. Turning off Fast Discovery switches saved searches to hourly checks.'

export const freshnessAnswer =
  'Scheduled scans consider posts from the previous seven days. A post can appear minutes after publication if the source has already indexed it and the current search matches. Keyword rotation, provider delays and the time of the next scan affect when a lead reaches your inbox.'

export const buyerQualityMethod =
  'The buyer quality score gives 30 points for a hiring request, 25 for a budget signal, 20 for evidence of a business or website, 15 for urgency and up to 10 for verifiable account age. An explicitly unpaid request earns zero budget points. When the post gives too little evidence to classify it, the score can be unavailable.'

export const buyerQualityExample =
  'For example, a merchant who says “We are hiring a developer to repair our store checkout by Friday. Our budget is $800” could earn 90 points before account age is considered. Open the thread to confirm the scope, whether the buyer still needs help and who can approve the work.'
