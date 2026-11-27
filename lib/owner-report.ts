import 'server-only'
import { notFound } from 'next/navigation'
import { admin } from '@/lib/db/admin'
import { missingDatabaseResource } from '@/lib/db/missing-resource'
import { requireUser } from '@/lib/db/server'
import { isPlatformOwner } from '@/lib/owner-access'

type SearchParams = Record<string, string | string[] | undefined>

function pageNumber(value: SearchParams[string]) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,8}$/.test(value)) return 1
  return Number(value)
}

export async function getOwnerReport(params: SearchParams) {
  const { user } = await requireUser()
  if (!isPlatformOwner(user)) notFound()

  const filters = {
    days: params.days === '7' ? 7 : params.days === '90' ? 90 : 30,
    search: typeof params.q === 'string' ? params.q.trim().slice(0, 254) : '',
    userPage: pageNumber(params.users),
    purchasePage: pageNumber(params.purchases),
  }
  const { data: report, error } = await admin().rpc('owner_report', {
    p_days: filters.days, p_search: filters.search,
    p_user_page: filters.userPage, p_purchase_page: filters.purchasePage,
  })
  if (missingDatabaseResource(error, 'function', 'owner_report')) return { report: null, filters }
  if (error || !report) throw new Error('The owner report could not be loaded.')
  return { report, filters }
}
