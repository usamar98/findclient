import Link from 'next/link'
import { requireUser } from '@/lib/db/server'
import { NicheEditor } from '@/components/workspace/niche-editor'
import { removeNiche } from '../niche-actions'
import { connectTelegram, disconnectTelegram, savePreferences } from './actions'
export default async function Settings() {
  const { db, user } = await requireUser(),
    [{ data: p, error }, { data: niches, error: nicheError }] =
      await Promise.all([
        db.from('profiles').select('*').eq('id', user.id).single(),
        db.from('niches').select('*').eq('user_id', user.id).order('id'),
      ])
  if (error || nicheError) throw new Error('Settings unavailable')
  return (
    <>
      <h1>Workspace settings</h1>
      <section className="panel">
        <h2>Plan and balance</h2>
        <p>
          {p.plan} · {p.credits} credits
        </p>
        <Link href="/pricing">View plans and credit packs</Link>
        {p.stripe_customer_id && (
          <form action="/api/portal" method="post">
            <button>View billing and receipts</button>
          </form>
        )}
      </section>
      <h2>Your niches</h2>
      {niches?.map((n) => (
        <details className="panel" key={n.id}>
          <summary>
            {n.skill} · {n.active ? 'Active' : 'Paused'}
          </summary>
          <NicheEditor
            id={n.id}
            initial={{
              skill: n.skill,
              keywords: n.keywords,
              negative_keywords: n.negative_keywords,
              sources: n.sources,
              min_intent: n.min_intent,
              active: n.active,
              portfolio_url: n.portfolio_url ?? '',
              pitch_style: n.pitch_style,
            }}
          />
          <details>
            <summary>Remove this niche</summary>
            <p>Removing this niche also deletes its leads and drafts.</p>
            <form action={removeNiche}>
              <input type="hidden" name="id" value={n.id} />
              <button>Delete niche and leads</button>
            </form>
          </details>
        </details>
      ))}
      {(niches?.length ?? 0) < (p.plan === 'agency' ? 5 : 1) && (
        <Link href="/app/onboarding">Add a niche</Link>
      )}
      <form action={savePreferences} className="panel">
        <h2>Writing and email</h2>
        <label>
          Your name
          <input name="name" defaultValue={p.name} maxLength={100} />
        </label>
        <label>
          Brand voice and signature
          <textarea name="branding" defaultValue={p.branding} maxLength={600} />
        </label>
        <label className="check">
          <input
            name="digest"
            type="checkbox"
            defaultChecked={p.digest_enabled}
          />
          Send a daily digest of my top leads
        </label>
        <button>Save preferences</button>
      </form>
      <section className="panel">
        <h2>Telegram alerts</h2>
        <p>Receive a notification when a new lead scores at least 80.</p>
        {p.telegram_chat_id ? (
          <form action={disconnectTelegram}>
            <button>Disconnect Telegram</button>
          </form>
        ) : process.env.TELEGRAM_BOT_USERNAME ? (
          <form action={connectTelegram}>
            <button>Connect my Telegram account</button>
          </form>
        ) : (
          <p>The workspace administrator needs to connect a Telegram bot.</p>
        )}
      </section>
    </>
  )
}
