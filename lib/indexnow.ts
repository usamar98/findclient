import 'server-only'

// This public site-ownership key is served verbatim at /indexnow-key.txt.
const defaultOwnershipKey = '6796c2b77ab9474894a0c1676192508d'

export function indexNowKey() {
  const key = process.env.INDEXNOW_KEY || defaultOwnershipKey
  return /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : null
}
