'use client'
import { useActionState, useState } from 'react'
import { proposalCurrencies, type Proposal } from '@/lib/proposals/model'
import { changeProposal } from './actions'
import { LogoField } from './logo-field'

export function ProposalEditor({ id, draft, revision, shareUrl }: {
  id: string; draft: Proposal; revision: number; shareUrl: string | null
}) {
  const [message, submit, pending] = useActionState(changeProposal.bind(null, id), '')
  const [packages, setPackages] = useState(() => draft.packages.map((pack, key) => ({ ...pack, key })))
  const [copied, setCopied] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  return (
    <form action={submit} className="proposal-editor stack" onReset={event => event.preventDefault()}>
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="count" value={packages.length} />
      <fieldset>
        <legend>Proposal details</legend>
        <div className="proposal-columns">
          <label>Your studio or name<input name="brand" defaultValue={draft.brand} required maxLength={100} /></label>
          <label>Prepared for<input name="recipient" defaultValue={draft.recipient} required maxLength={140} /></label>
        </div>
        <LogoField initial={draft.logo} onBusy={setLogoBusy} />
        <label>Project title<input name="title" defaultValue={draft.title} required maxLength={200} /></label>
        <label>Scope of work<textarea name="scope" defaultValue={draft.scope} required maxLength={2400} rows={4} /></label>
        <label>Contact details <small>(optional)</small><input name="contact" defaultValue={draft.contact} maxLength={200} placeholder="Email, website, or phone" /></label>
      </fieldset>
      <fieldset>
        <legend>Packages and pricing</legend>
        <label>Currency<select name="currency" defaultValue={draft.currency}>{proposalCurrencies.map(code => <option key={code}>{code}</option>)}</select></label>
        {packages.map((pack, i) => (
          <div className="proposal-package" key={pack.key}>
            <div className="proposal-package-head"><h2>Package {i + 1}</h2>
              {packages.length > 1 && <button type="button" onClick={() => setPackages(packages.filter(p => p.key !== pack.key))}>Remove</button>}
            </div>
            <label>Name<input name={'name' + i} defaultValue={pack.name} required maxLength={80} /></label>
            <label>Deliverables<textarea name={'details' + i} defaultValue={pack.details} required maxLength={800} rows={3} /></label>
            <div className="proposal-columns">
              <label>Package price<input name={'price' + i} type="number" step="0.01" min="0" max="999999999.99"
                defaultValue={pack.priceCents === null ? '' : pack.priceCents / 100} placeholder="Quote after scoping" /></label>
              <label>Delivery timeline<input name={'timeline' + i} defaultValue={pack.timeline} required maxLength={150} /></label>
            </div>
          </div>
        ))}
        {packages.length < 3 && <button type="button" onClick={() => setPackages([...packages, {
          key: Math.max(...packages.map(p => p.key)) + 1, name: '', details: '', priceCents: null, timeline: '',
        }])}>Add package</button>}
      </fieldset>
      <div className="actions">
        <button name="action" value="save" disabled={pending || logoBusy}>Save draft</button>
        <button formAction={'/app/proposals/' + id + '/pdf'} formMethod="post" disabled={logoBusy}>Download PDF</button>
        <button name="action" value="publish" disabled={pending || logoBusy}>{shareUrl ? 'Publish changes' : 'Create share link'}</button>
      </div>
      {message && <p role="status">{message}</p>}
      {shareUrl && <fieldset id="published-link">
        <legend>Published link</legend>
        <label>Share with your client<input value={shareUrl} readOnly onFocus={event => event.target.select()} /></label>
        <div className="actions">
          <button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(shareUrl); setCopied('Link copied.') }
            catch { setCopied('Select the link above and copy it.') }
          }}>Copy link</button>
          <button formNoValidate name="action" value="rotate" disabled={pending}>Replace link</button>
          <button formNoValidate name="action" value="revoke" disabled={pending}>Turn off sharing</button>
        </div>
        {copied && <p role="status">{copied}</p>}
      </fieldset>}
    </form>
  )
}
