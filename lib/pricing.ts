import 'server-only'
import { cache } from 'react'
import { admin } from './db/admin'
export async function maximumModelCost() {
  const { data, error } = await admin()
    .from('product_config')
    .select('credits,price_cents')
    .like('product', 'topup%')
  if (error || !data?.length) throw new Error('Credit pricing is unavailable.')
  return (
    Math.min(...data.map((item) => item.price_cents / 100 / item.credits)) * 0.5
  )
}
export const getPricing = cache(async function getPricing(): Promise<{
  sales: number | null
  price: number | null
  spots: number | null
}> {
  const unavailable = { sales: null, price: null, spots: null }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    return { ...unavailable, price: 149 }
  const { data, error } = await admin()
    .rpc('lifetime_price')
    .single<{ sales: number; price: number; spots: number }>()
  return error || !data ? unavailable : data
})
type Offer = {
  product: 'lifetime' | 'monthly' | 'topup9' | 'topup19' | 'topup29'
  price: number | null
  credits: number
}
// Seeded fixed offers keep the marketing preview usable before a Supabase project is connected.
const defaults: Offer[] = [
  { product: 'lifetime', price: 149, credits: 150 },
  { product: 'monthly', price: 49, credits: 150 },
  { product: 'topup9', price: 9, credits: 100 },
  { product: 'topup19', price: 19, credits: 250 },
  { product: 'topup29', price: 29, credits: 400 },
]
export async function getOffers(): Promise<Offer[]> {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    return defaults
  const [config, tier] = await Promise.all([
    admin().from('product_config').select('product,price_cents,credits'),
    getPricing(),
  ])
  if (config.error) return defaults.map((o) => ({ ...o, price: null }))
  return defaults.map((o) => {
    const row = config.data.find((r) => r.product === o.product)
    return {
      product: o.product,
      price: row
        ? o.product === 'lifetime'
          ? tier.price
          : row.price_cents / 100
        : null,
      credits: row?.credits ?? o.credits,
    }
  })
}
