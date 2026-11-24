'use client'
import { useActionState } from 'react'
import { saveAlertSettings } from '@/app/app/settings/alert-actions'

export function AlertPreferencesForm({
  fast,
  email,
  minimum,
  connected,
}: {
  fast: boolean
  email: boolean
  minimum: number
  connected: boolean
}) {
  const [message, action, pending] = useActionState(saveAlertSettings, '')
  return (
    <form id="alert-settings" className="panel" action={action}>
      <h2>Priority alerts</h2>
      <label className="check">
        <input type="checkbox" name="fast" defaultChecked={fast} />
        Check Hacker News, Bluesky and Shopify Community every 10 minutes
      </label>
      <p>
        Other sources run hourly. Provider delays can affect when a post
        appears. Scoring a new request uses one credit.
      </p>
      <label>
        Minimum intent score for priority alerts
        <input
          type="number"
          name="minimum"
          min={0}
          max={100}
          defaultValue={minimum}
          required
        />
      </label>
      <label className="check">
        <input type="checkbox" name="email" defaultChecked={email} />
        Email me matching leads as they arrive
      </label>
      <label>
        {connected
          ? 'Replace connected webhook'
          : 'Connect a Slack or automation webhook'}
        <input
          name="endpoint"
          type="url"
          maxLength={1600}
          autoComplete="off"
          placeholder="https://"
        />
      </label>
      <p>
        Use a Slack incoming webhook, Zapier Catch Hook, Make webhook or n8n
        Cloud production webhook to send leads to your team or CRM.
      </p>
      {connected && (
        <label className="check">
          <input type="checkbox" name="disconnect" />
          Disconnect current webhook
        </label>
      )}
      <button disabled={pending}>Save alert preferences</button>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
