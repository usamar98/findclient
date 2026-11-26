import { researchSourceLabels, researchSources, type ResearchSourceId } from './research-catalog'

export const platformGuideUpdated = '2026-11-26'

export const platformGuideAnswer =
  'Lead To Client searches 12 public sources in Live Research. Eight cover community conversations. For paid freelance work, choose We Work Remotely, Remote OK, GitHub paid bounties or Mastodon hiring posts. Each result links to the original post so you can check the request before replying.'
export const platformAccessAnswer =
  'Nine Live Research sources work without API keys. These are Hacker News, Bluesky, Stack Overflow, Shopify Community, selected public forums and all four paid-work sources. Direct Reddit and X searches require configured platform credentials. Reddit and X can also use the Exa search index, which Indie Hackers requires. Indexed posts may appear later than posts from a direct feed.'
export const platformBrowseAnswer =
  'Choose the paid freelance jobs preset and leave Keywords empty to browse across all four paid-work sources. Add a skill to narrow the results. Searches that include community sources need a keyword. Live Research uses no scoring credits.'
export const platformFreshnessAnswer =
  'Live Research offers windows of one minute, 15 minutes, one hour and 24 hours. It checks the publication time supplied by the source and requires a precise timestamp. Feed updates, indexing delays and the number of people posting affect each result. A short window can return zero matches.'
export const platformRuntimeAnswer =
  'The results show the time the search was checked, the total search runtime and the response time for each selected source. These durations measure how long the search took. Use the publication time on the result to see how old the post is.'
export const platformWatchAnswer =
  'After at least one selected source responds, a one-minute or 15-minute Live Research window using only keyless sources can recheck every minute while the tab is visible. Saved searches run separately and can send scored community leads to your inbox. The four paid-work sources are available through Live Research.'

type SourceDescription = { detail: string; reference: string; url: string }
const descriptions: Record<ResearchSourceId, SourceDescription> = {
  hn: {
    detail: 'Searches public Hacker News stories, job posts and comments. In short windows it can check recent items directly, including a new comment on an older thread.',
    reference: 'Hacker News API',
    url: 'https://github.com/HackerNews/API',
  },
  bluesky: {
    detail: 'Looks for recent public posts that match your service or hiring terms, using Bluesky’s latest-post search.',
    reference: 'Bluesky post search',
    url: 'https://docs.bsky.app/docs/api/app-bsky-feed-search-posts',
  },
  stackexchange: {
    detail: 'Finds open Stack Overflow questions by their creation time. Read the question to see whether the author wants technical advice or paid help.',
    reference: 'Stack Exchange questions API',
    url: 'https://api.stackexchange.com/docs/questions',
  },
  shopify: {
    detail: 'Checks merchant and developer community feeds for topics and replies. A new reply can qualify on its own publication time and link directly to that reply.',
    reference: 'Shopify Community posts feed',
    url: 'https://community.shopify.com/posts.rss',
  },
  reddit: {
    detail: 'Finds recent public Reddit threads through configured Reddit access or the Exa index. Open the subreddit thread to read the original request and its community rules.',
    reference: 'Reddit search API',
    url: 'https://www.reddit.com/dev/api/#GET_search',
  },
  indiehackers: {
    detail: 'Searches public Indie Hackers discussions through Exa. A discussion must reach the index and have a precise publication time to appear in a short-window search.',
    reference: 'Exa search documentation',
    url: 'https://docs.exa.ai/reference/search',
  },
  x: {
    detail: 'Searches recent public posts through configured X API access or the Exa index. Direct results use the post’s creation time.',
    reference: 'X post search',
    url: 'https://docs.x.com/x-api/posts/search/introduction',
  },
  forums: {
    detail: 'Checks selected Bubble, WordPress support and Webflow forums for requests. Results link to the original discussion or reply.',
    reference: 'WordPress support forums feed',
    url: 'https://wordpress.org/support/forums/feed/',
  },
  weworkremotely: {
    detail: 'Looks for freelance and contract listings with evidence of pay. We Work Remotely specifies an hourly feed refresh, so a new listing can miss a 15-minute search.',
    reference: 'We Work Remotely job feed',
    url: 'https://weworkremotely.com/remote-jobs.rss',
  },
  remoteok: {
    detail: 'Looks for freelance and contract listings with evidence of pay in the listing text or salary data. Age uses the board’s listing date. Employers can renew a listing.',
    reference: 'Remote OK listing FAQ',
    url: 'https://remoteok.com/faq',
  },
  github: {
    detail: 'Looks for open, unassigned issues where a repository owner, member or collaborator offers a specific cash amount for a deliverable. Age is measured from issue creation.',
    reference: 'GitHub issue search',
    url: 'https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests',
  },
  mastodon: {
    detail: 'Looks for original public posts from people offering paid freelance work in selected hiring tags visible on mastodon.social. Coverage includes accounts that allow indexing.',
    reference: 'Mastodon hashtag timelines',
    url: 'https://docs.joinmastodon.org/methods/timelines/#tag',
  },
}

export const platformGuideRows = researchSources.map(id => ({
  id,
  name: researchSourceLabels[id],
  ...descriptions[id],
}))
