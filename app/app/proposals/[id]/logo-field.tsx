'use client'
import Image from 'next/image'
import { useState } from 'react'

export function LogoField({ initial, onBusy }: { initial?: string | null; onBusy: (busy: boolean) => void }) {
  const [logo, setLogo] = useState(initial ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function choose(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a JPG or PNG smaller than 2 MB.')
      return
    }
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const ratio = Math.min(480 / bitmap.width, 160 / bitmap.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
        const context = canvas.getContext('2d')!
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const jpeg = canvas.toDataURL('image/jpeg', 0.75)
        if (jpeg.length > 65536) throw new Error('Logo too large')
        setLogo(jpeg)
      } finally { bitmap.close() }
    } catch { setError('The logo could not be read. Choose a smaller JPG or PNG.') }
    finally { setBusy(false); onBusy(false) }
  }
  return <div>
    <input type="hidden" name="logo" value={logo} />
    <label>Studio logo <small>(optional)</small>
      <input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => {
        void choose(event.currentTarget.files?.[0])
        event.currentTarget.value = ''
      }} />
    </label>
    {busy && <p role="status">Preparing logo…</p>}
    {logo && <div className="actions"><Image src={logo} width={150} height={50} unoptimized alt="Studio logo"
      style={{ objectFit: 'contain', objectPosition: 'left center' }} />
      <button type="button" disabled={busy} onClick={() => setLogo('')}>Remove logo</button></div>}
    {error && <p role="alert">{error}</p>}
  </div>
}
