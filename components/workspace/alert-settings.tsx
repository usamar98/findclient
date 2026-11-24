import { requireUser } from '@/lib/db/server'
import { admin } from '@/lib/db/admin'
import { AlertPreferencesForm } from './alert-preferences-form'

export async function AlertSettings() {
  const { db, user } = await requireUser()
  const [prefs, hook] = await Promise.all([
    db
      .from('profiles')
      .select('fast_discovery,priority_email,priority_alert_min')
      .eq('id', user.id)
      .single(),
    admin()
      .from('alert_destinations')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  if (prefs.error || hook.error)
    throw new Error('Alert preferences unavailable')
  return (
    <AlertPreferencesForm
      fast={prefs.data.fast_discovery}
      email={prefs.data.priority_email}
      minimum={prefs.data.priority_alert_min}
      connected={Boolean(hook.data)}
    />
  )
}
