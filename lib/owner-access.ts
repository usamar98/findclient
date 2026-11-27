const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Call only with the user returned by Supabase Auth's server-side getUser().
export function isPlatformOwner(user: { id: string; is_anonymous?: boolean }) {
  const ownerId = process.env.OWNER_USER_ID?.trim()
  return Boolean(ownerId && uuid.test(ownerId) && !user.is_anonymous &&
    ownerId.toLowerCase() === user.id.toLowerCase())
}
