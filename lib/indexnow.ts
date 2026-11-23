import 'server-only'
export function indexNowKey() {
  const key = process.env.INDEXNOW_KEY
  return key && /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : null
}
