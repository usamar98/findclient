export const OWNER_PAGE_SIZE = 20

type OwnerDirectory<Row> = { total: number; rows: Row[] }

export type OwnerReport = {
  summary: { signups: number; activated: number; buyers: number; grossCents: number }
  users: OwnerDirectory<{
    id: string
    email: string | null
    createdAt: string
    lastSignInAt: string | null
    plan: string | null
    hasLead: boolean
  }>
  purchases: OwnerDirectory<{
    id: string
    email: string | null
    createdAt: string
    product: string
    amountCents: number
    city: string | null
    country: string | null
  }>
  sources: { source: string; found: number; scored: number; matched: number; failed: number }[]
  cities: { city: string | null; country: string | null; purchases: number }[]
}
