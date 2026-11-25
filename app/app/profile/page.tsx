import Link from 'next/link'
import { requireUser } from '@/lib/db/server'
import { planLabels } from '@/lib/offers'
import './profile.css'

export const metadata = { title: 'Profile | Lead To Client' }
const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export default async function Profile() {
  const { db, user } = await requireUser()
  const { data: profile, error } = await db.from('profiles')
    .select('name,email,credits,plan,next_refill_at').eq('id', user.id).single()
  if (error || !profile) throw new Error('Unable to load your account details.')
  const name = profile.name || (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '')
  return (
    <div className="work-profile">
      <h1>Profile</h1>
      <div className="work-profile-grid">
        <section className="panel">
          <h2>Account details</h2>
          <dl>
            {name && <><dt>Name</dt><dd>{name}</dd></>}
            <dt>Email</dt><dd>{user.email || profile.email}</dd>
            <dt>Member since</dt><dd><time dateTime={user.created_at}>{formatDate.format(new Date(user.created_at))}</time></dd>
          </dl>
          <Link href="/app/settings">Open workspace settings</Link>
        </section>
        <section className="panel">
          <h2>Plan and credits</h2>
          <dl>
            <dt>Remaining credits (points)</dt><dd className="work-profile-balance">{profile.credits.toLocaleString('en-US')}</dd>
            <dt>Current plan</dt><dd>{planLabels[profile.plan]}</dd>
            {profile.next_refill_at && <><dt>Next credit refill</dt><dd><time dateTime={profile.next_refill_at}>{formatDate.format(new Date(profile.next_refill_at))} UTC</time></dd></>}
          </dl>
          <Link href="/pricing">View pricing and credit packs</Link>
        </section>
      </div>
    </div>
  )
}
