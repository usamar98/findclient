export function alertDestination(
  raw: string,
): { url: string; slack: boolean } | null {
  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      url.href.length > 1600
    )
      return null
    const host = url.hostname
    const path = url.pathname
    const slack =
      host === 'hooks.slack.com' &&
      /^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(path)
    const zapier =
      host === 'hooks.zapier.com' &&
      /^\/hooks\/catch\/[0-9]+\/[\w-]+\/?$/.test(path)
    const make =
      /^hook\.(?:us|eu)\d+\.make\.com$/.test(host) && /^\/[\w-]+$/.test(path)
    const n8n =
      /^[a-z0-9-]+\.app\.n8n\.cloud$/.test(host) &&
      /^\/webhook\/[a-zA-Z0-9_/-]+$/.test(path)
    return slack || zapier || make || n8n ? { url: url.href, slack } : null
  } catch {
    return null
  }
}
