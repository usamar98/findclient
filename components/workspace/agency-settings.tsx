import Link from 'next/link'
import { acceptInvite, cancelInvite, removeMember } from '@/app/app/agency-actions'
import { admin } from '@/lib/db/admin'
import { requireUser } from '@/lib/db/server'
import { TeamInviteForm } from './agency-forms'

export async function AgencySettings() {
  const { db, user } = await requireUser()
  const [people, invites, workspaces] = await Promise.all([
    admin().rpc('workspace_people', { p_owner: user.id, p_actor: user.id }),
    db.from('workspace_invites').select('*').gt('expires_at', new Date().toISOString()).order('expires_at'),
    admin().rpc('list_workspaces', { p_actor: user.id }),
  ])
  if (people.error || invites.error || workspaces.error) throw new Error('Team settings unavailable')
  return <section className="panel" id="team">
    <h2>Agency inbox</h2>
    <p>Invite teammates to review your leads, edit replies, manage deals, and prepare proposals. Generated replies use this workspace’s credits.</p>
    <TeamInviteForm />
    {invites.data.map(invite => <div key={invite.id} className="panel">
      <p>{invite.owner_id === user.id ? 'Pending invitation for ' + invite.email : invite.owner_name + ' invited you to their workspace.'}</p>
      {invite.owner_id !== user.id && <form action={acceptInvite}><input type="hidden" name="invite" value={invite.id}/><button>Accept invitation</button></form>}
      <form action={cancelInvite}><input type="hidden" name="invite" value={invite.id}/><button>{invite.owner_id === user.id ? 'Cancel invitation' : 'Decline'}</button></form>
    </div>)}
    {people.data.filter(person => person.id !== user.id).map(person => <form key={person.id} action={removeMember}>
      <input type="hidden" name="owner" value={user.id}/><input type="hidden" name="member" value={person.id}/>
      <p>{person.name} · Teammate</p><button>Remove teammate</button>
    </form>)}
    {workspaces.data.filter(space => space.id !== user.id).map(space => <form key={space.id} action={removeMember}>
      <input type="hidden" name="owner" value={space.id}/><input type="hidden" name="member" value={user.id}/>
      <p><Link href={'/app/inbox?view=history&workspace=' + space.id}>{space.name}’s shared inbox</Link></p><button>Leave workspace</button>
    </form>)}
  </section>
}
