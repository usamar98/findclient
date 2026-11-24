import 'server-only'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from './db/server'
import { admin } from './db/admin'

export async function requireLeadAccess(id: string) {
  if (!z.uuid().safeParse(id).success) notFound()
  const { db, user } = await requireUser()
  const { data: lead, error } = await db.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Lead unavailable')
  if (!lead) notFound()
  return { db, user, lead, ownerId: lead.user_id }
}

export async function getWorkspacePeople(ownerId: string) {
  const { user } = await requireUser()
  const { data, error } = await admin().rpc('workspace_people', { p_owner: ownerId, p_actor: user.id })
  if (error) throw new Error('Workspace members unavailable')
  return data ?? []
}
