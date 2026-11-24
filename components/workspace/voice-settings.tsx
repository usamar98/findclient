import { requireUser } from '@/lib/db/server'
import { saveVoice } from '@/app/app/settings/voice-actions'

export async function VoiceSettings() {
  const { db, user } = await requireUser()
  const { data, error } = await db
    .from('profiles')
    .select('voice_examples,learn_from_edits')
    .eq('id', user.id)
    .single()
  if (error) throw new Error('Writing preferences unavailable.')
  return (
    <form className="panel" action={saveVoice}>
      <h2>Write in my voice</h2>
      <p>
        Drafts use your niche’s portfolio style and your own writing examples.
        Paste a reply that sounds like you.
      </p>
      <label>
        Past replies
        <textarea
          name="examples"
          rows={5}
          maxLength={3000}
          defaultValue={data.voice_examples}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="learn"
          defaultChecked={data.learn_from_edits}
        />{' '}
        Learn from replies I edit and save in Clientfind
      </label>
      <p className="meta">
        When enabled, up to three of your recent edits in the same workspace
        help shape future drafts.
      </p>
      <button>Save writing preferences</button>
    </form>
  )
}
