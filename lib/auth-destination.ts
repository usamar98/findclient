// Auth redirects may resume a workspace page, including its inbox filters.
export function workspaceDestination(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1600 || !/^\/app(?:[/?#]|$)/.test(value) || /[\\\r\n]/.test(value)) return null
  const url = new URL(value, 'https://workspace.invalid')
  if (!/^\/app(?:\/|$)/.test(url.pathname)) return null
  return url.pathname + url.search + url.hash
}
