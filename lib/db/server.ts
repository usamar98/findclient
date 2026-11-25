import 'server-only'
import type { Database } from './schema'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
export const authConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
export async function database() {
  const jar = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(items) {
          try {
            for (const { name, value, options } of items)
              jar.set(name, value, options)
          } catch {
            /* Middleware refreshes cookies during Server Component rendering. */
          }
        },
      },
    },
  )
}
export const requireUser = cache(async function requireUser() {
  if (!authConfigured()) redirect('/auth/login')
  const db = await database()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/auth/login')
  return { db, user }
})
