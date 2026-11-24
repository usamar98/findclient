const discussionHosts =
  /(?:^|\.)(?:reddit\.com|redd\.it|x\.com|twitter\.com|t\.co|bsky\.app|ycombinator\.com|indiehackers\.com|stackoverflow\.com|stackexchange\.com|community\.shopify\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|youtu\.be|github\.com|bit\.ly|tinyurl\.com)$/i

export function publicSite(value: string): URL | null {
  try {
    if (!value || value.length > 1500) return null
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : 'https://' + value,
    )
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname) ||
      /\.(?:local|localhost|test|invalid|internal|lan|onion|home|arpa|example)$/i.test(
        url.hostname,
      ) ||
      discussionHosts.test(url.hostname)
    )
      return null
    url.protocol = 'https:'
    url.search = ''
    url.hash = ''
    return url
  } catch {
    return null
  }
}

export function posterWebsite(
  title: string,
  body: string,
  sourceUrl: string,
): string | null {
  const text = (title + '\n' + body).slice(0, 7000)
  let sourceHost = ''
  try {
    sourceHost = new URL(sourceUrl).hostname
  } catch {
    /* Some imported leads lack a valid source. */
  }
  const links =
    /(?:https?:\/\/|www\.)[^\s<>"'\])}]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'\])}]*)?/gi
  for (const match of text.matchAll(links)) {
    const start = match.index ?? 0
    const before = text.slice(Math.max(0, start - 95), start)
    const after = text.slice(
      start + match[0].length,
      start + match[0].length + 45,
    )
    if (
      before.endsWith('@') ||
      /(?:example|inspiration|competitor|similar to|like this|documentation|tutorial)\b[^.!?\n]{0,40}$/i.test(
        before,
      )
    )
      continue
    const owner =
      /\b(?:my|our|client['’]s|the company['’]s)\s+(?:(?:shopify|current|new|business|company|portfolio|ecommerce|wordpress|webflow)\s+){0,2}(?:site|website|shop|store|homepage|domain|landing page)\b[^.!?\n]{0,65}$/i.test(
        before,
      ) ||
      /\b(?:site|store|website|domain)\s*(?:url|link)?\s*[:=]\s*$/i.test(
        before,
      ) ||
      /^\s+is (?:my|our) (?:site|store|website)\b/i.test(after)
    if (!owner) continue
    const url = publicSite(match[0].replace(/[.,;:!?]+$/, ''))
    if (url && url.hostname !== sourceHost) return url.href
  }
  return null
}
