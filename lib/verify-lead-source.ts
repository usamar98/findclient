import 'server-only'
import { admin } from './db/admin'
import { ProviderBackoff } from './sources/shared'
import { checkBuyerSource } from './sources/verification'

export async function verifyLeadSource(
  target: Parameters<typeof checkBuyerSource>[0],
  includeAccount = false,
) {
  const unknown = {
    availability: {
      state: 'unknown' as const,
      checked_at: new Date().toISOString(),
    },
    accountCreated: null,
    profileSite: null,
  }
  if (!['hn', 'bluesky', 'stackexchange'].includes(target.source))
    return unknown
  const db = admin()
  const cooldown = await db
    .from('source_backoffs')
    .select('retry_at')
    .eq('source', target.source)
    .maybeSingle()
  if (cooldown.error) throw cooldown.error
  if (cooldown.data && Date.parse(cooldown.data.retry_at) > Date.now())
    return unknown
  try {
    return await checkBuyerSource(target, includeAccount)
  } catch (error) {
    if (!(error instanceof ProviderBackoff)) throw error
    const { error: writeError } = await db.rpc('defer_source', {
      p_source: target.source,
      p_until: error.retryAt.toISOString(),
    })
    if (writeError) throw writeError
    return unknown
  }
}
