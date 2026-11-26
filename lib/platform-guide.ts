import { researchSourceLabels, researchSources, type ResearchSourceId } from './research-catalog'

export const platformGuideUpdated = '2026-11-26'

export const platformGuideAnswer =
  'Lead To Client searches 12 public sources in Live Research. The 24-hour Jobs feed covers freelance hiring posts from Hacker News, Bluesky and Mastodon, contracts from We Work Remotely and Remote OK, and paid GitHub bounties. Each result links to the original post so you can check the request before replying.'
export const platformAccessAnswer =
  'Nine Live Research sources work without API keys. These are Hacker News, Bluesky, Stack Overflow, Shopify Community, selected public forums and all four paid-work sources. Direct Reddit and X searches require configured platform credentials. Reddit and X can also use the Exa search index, which Indie Hackers requires. Indexed posts may appear later than posts from a direct feed.'
export const platformBrowseAnswer =
  'Open Jobs in the workspace to browse openings published in the past 24 hours across six sources. Add a skill to narrow the results. For a shorter window, select the individual sources in Live Research. Searches that include community sources need a keyword. A linked Telegram account can search the same jobs with /jobs or watch a skill with /watch. Jobs and Live Research use no scoring credits.'
export const platformFreshnessAnswer =
  'Choose “Past 15 minutes” to see matching posts published in the 15 minutes ending at the search’s “Checked” time. A post exactly 15 minutes old qualifies. Lead To Client shows both times in UTC and requires a precise publication timestamp. If a listing reaches a feed after that window closes, try “Past hour” or “Past 24 hours”.'
export const platformTimingNote =
  'The intervals below are Lead To Client’s cache settings. After an interval elapses, a search can refresh the saved response. A publisher may release a listing later, a search index may take time to pick it up, or a source may limit requests. The time from publication to discovery can therefore be longer.'
export const platformRuntimeAnswer =
  'Posted is the source’s publication time. First found is when Lead To Client first recorded the job. The first discovery time stays the same on later searches. Live Research also shows when the search ran and how long each platform check took.'
export const platformWatchAnswer =
  'To enable the 1-minute recheck, choose “Past minute” or “Past 15 minutes” and select only sources that work without API keys. Run the search. Once at least one source completes its check, turn on “Check again every minute while this tab is visible”. The next check can start 60 seconds after the previous one finishes. A hidden tab skips checks, and changing the search settings turns the recheck off.'

type SourceDescription = { detail: string; freshness: string; reference: string; url: string }
const descriptions: Record<ResearchSourceId, SourceDescription> = {
  hn: {
    detail: 'Searches public stories, job posts and comments. Qualifying freelance hiring requests, including employer comments on Who is hiring? threads, also appear in 24-hour Jobs and Telegram. A comment uses its own publication time.',
    freshness: 'Age starts when the story, job or comment was created. For short windows the app samples the newest items with a 10-second cache and also checks Algolia search with a 20-second cache. The index can lag.',
    reference: 'Hacker News API',
    url: 'https://github.com/HackerNews/API',
  },
  bluesky: {
    detail: 'Searches recent public posts that match your service. The shared hiring feed also checks for explicit requests for freelance work and makes qualifying posts searchable in 24-hour Jobs and Telegram.',
    freshness: 'Age uses the post’s creation time. The app searches newest first with a 20-second cache. A post can appear once Bluesky’s public search indexes it.',
    reference: 'Bluesky post search',
    url: 'https://docs.bsky.app/docs/api/app-bsky-feed-search-posts',
  },
  stackexchange: {
    detail: 'Finds open Stack Overflow questions by their creation time. Read the question to see whether the author wants technical advice or paid help.',
    freshness: 'Age starts when the question was asked. Short searches check the newest questions with a 60-second cache. Stack Exchange can require a longer pause when it limits requests.',
    reference: 'Stack Exchange questions API',
    url: 'https://api.stackexchange.com/docs/questions',
  },
  shopify: {
    detail: 'Checks merchant and developer community feeds for topics and replies. A new reply can qualify on its own publication time and link directly to that reply.',
    freshness: 'Age uses the RSS publication time of the topic or individual reply. Each community feed has a cache interval of at least 60 seconds. A longer delay requested by the publisher takes precedence.',
    reference: 'Shopify Community posts feed',
    url: 'https://community.shopify.com/posts.rss',
  },
  reddit: {
    detail: 'Finds recent public Reddit threads through configured Reddit access or the Exa index. Open the subreddit thread to read the original request and its community rules.',
    freshness: 'With direct access, each search requests the newest matching threads without caching the response and uses Reddit’s thread creation time. With Exa, visibility depends on indexing and a precise publication time. Neither route has a verified delivery interval.',
    reference: 'Reddit search API',
    url: 'https://www.reddit.com/dev/api/#GET_search',
  },
  indiehackers: {
    detail: 'Searches public Indie Hackers discussions through Exa. A discussion must reach the index and have a precise publication time to appear in a short-window search.',
    freshness: 'Age uses the publication time reported by Exa. The index has no verified delay for new Indie Hackers posts. A result with only a calendar date is excluded.',
    reference: 'Exa search documentation',
    url: 'https://docs.exa.ai/reference/search',
  },
  x: {
    detail: 'Searches recent public posts through configured X API access or the Exa index. Direct results use the post’s creation time.',
    freshness: 'With direct access, each search requests recent posts without caching the response and uses X’s post creation time. With Exa, posts appear after indexing if they have a precise publication time. Neither route has a verified delivery interval.',
    reference: 'X post search',
    url: 'https://docs.x.com/x-api/posts/search/introduction',
  },
  forums: {
    detail: 'Checks selected Bubble, WordPress support and Webflow forums for requests. Results link to the original discussion or reply.',
    freshness: 'Age uses the publication time of the individual feed entry. Bubble, WordPress and Webflow feeds each have a cache interval of at least 60 seconds, subject to their crawl delays. WordPress thread activity is checked against dated posts or replies.',
    reference: 'WordPress support forums feed',
    url: 'https://wordpress.org/support/forums/feed/',
  },
  weworkremotely: {
    detail: 'Looks for freelance and contract listings with evidence of pay in the public jobs feed.',
    freshness: 'Age uses the RSS listing’s publication time. The feed asks readers to cache it for 60 minutes, and the app uses that interval. A listing can be older than 15 minutes when it first appears in a search.',
    reference: 'We Work Remotely job feed',
    url: 'https://weworkremotely.com/remote-jobs.rss',
  },
  remoteok: {
    detail: 'Looks for freelance and contract listings with evidence of pay in the listing text or salary data.',
    freshness: 'The app uses a 60-second cache for the public jobs feed. Age uses the board’s listing timestamp. Employers can renew listings, so the role itself may be older.',
    reference: 'Remote OK listing FAQ',
    url: 'https://remoteok.com/faq',
  },
  github: {
    detail: 'Looks for open, unassigned issues where a repository owner, member or collaborator offers a specific cash amount for a deliverable.',
    freshness: 'Age starts when the issue was opened. New comments or edits keep the original timestamp. The app uses a 60-second cache for issue search, and GitHub’s search index can lag.',
    reference: 'GitHub issue search',
    url: 'https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests',
  },
  mastodon: {
    detail: 'Looks for original public posts from people offering paid freelance work in selected hiring tags visible on mastodon.social. Coverage includes accounts that allow indexing.',
    freshness: 'Age starts when the original status was published. The app uses a 30-second cache for hiring-tag timelines on mastodon.social. Posts from another server must reach that timeline before a search can find them.',
    reference: 'Mastodon hashtag timelines',
    url: 'https://docs.joinmastodon.org/methods/timelines/#tag',
  },
}

export const platformGuideRows = researchSources.map(id => ({
  id,
  name: researchSourceLabels[id],
  ...descriptions[id],
}))
