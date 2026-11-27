import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './db/schema'
import { missingDatabaseResource } from './db/missing-resource'

type Address =
  { city?: string | null; country?: string | null } | null | undefined
type Location = { city: string | null; country: string | null }

function cityAndCountry(address: Address): Location {
  const country = address?.country?.trim().toUpperCase() ?? ''
  const city = (address?.city ?? '').replaceAll('\0', '').trim()
  return {
    city: Array.from(city).slice(0, 160).join('') || null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
  }
}

/** Both addresses, if supplied, must be snapshots from the same transaction. */
export function billingLocation(
  primary: Address,
  fallback?: Address,
): Location {
  const first = cityAndCountry(primary)
  const second = cityAndCountry(fallback)
  if (first.country && second.country && first.country !== second.country)
    return first
  if (
    first.city &&
    second.city &&
    first.city.toLowerCase() !== second.city.toLowerCase()
  )
    return first
  return {
    city: first.city ?? second.city,
    country: first.country ?? second.country,
  }
}

export async function recordBillingLocation(
  db: SupabaseClient<Database>,
  receipt: string,
  location: Location,
) {
  if (!location.city && !location.country) return
  const { error } = await db.rpc('record_purchase_location', {
    p_receipt: receipt,
    p_city: location.city,
    p_country: location.country,
  })
  // Hosted deployments and manually applied SQL can roll out separately.
  // Fulfillment has committed; the original receipt is available for backfill.
  if (missingDatabaseResource(error, 'function', 'record_purchase_location')) return
  if (error) throw new Error('Purchase location pending')
}
