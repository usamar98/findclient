import React from 'react'
import { mkdir, readFile } from 'node:fs/promises'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { BrandMark } from '../components/brand-mark'
import { homeSources, type HomeSource } from '../components/marketing/home-sources'

const colors: Record<HomeSource['id'], string> = {
  reddit: '#ff4500', x: '#101010', hn: '#ff6600', bluesky: '#0085ff',
  indiehackers: '#102338', stackexchange: '#f48024', shopify: '#6b933b', forums: '#404040',
}

function preview(source: HomeSource, reply: boolean, symbol?: string) {
  const label = reply ? 'Reply draft' : 'Lead inbox'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      border: '2px solid #dcdcdc', borderRadius: 18, background: '#fff',
      fontFamily: 'Geist', color: '#141414', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', background: '#fafafa', color: '#505050',
        height: 66, padding: '0 28px', borderBottom: '1px solid #ddd', fontSize: 18,
      }}>
        <BrandMark size={32} ink="#fff" tile="#141414" />
        <strong style={{ marginLeft: 9, fontSize: 22, color: '#141414', letterSpacing: '-1px' }}>Lead To Client</strong>
        <span style={{ margin: '0 10px', color: '#999' }}>/</span>
        <span>{label}</span>
        <span style={{ marginLeft: 'auto', border: '1px solid #ccc', borderRadius: 6, padding: '2px 10px', fontSize: 16 }}>Example</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '22px 30px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 22 }}>
          {/* Satori embeds the local SVG in the raster export. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {symbol && <img alt="" width={26} height={26} src={symbol} style={{ marginRight: 10 }} />}
          <strong>{source.name}</strong>
        </div>
        <div style={{
          display: 'flex', marginTop: 16, fontSize: reply ? 26 : 39,
          lineHeight: reply ? 1.15 : 1.08, letterSpacing: reply ? '-0.9px' : '-1.8px',
          fontWeight: reply ? 400 : 700,
        }}>{reply ? source.draft : source.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: 11, borderTop: '1px solid #dedede', fontSize: 16, color: '#555' }}>
          <strong style={{ background: '#f2f2f2', borderRadius: 4, padding: '2px 8px', marginRight: 12 }}>{reply ? 'Suggested reply' : source.skill}</strong>
          <span>{reply ? 'Draft' : 'New request'}</span>
        </div>
      </div>
    </div>
  )
}

async function main() {
  const [regular, bold] = await Promise.all(['Regular', 'Bold'].map(weight =>
    readFile('node_modules/geist/dist/fonts/geist-sans/Geist-' + weight + '.ttf'),
  ))
  const fonts = [
    { name: 'Geist', data: regular, weight: 400 as const },
    { name: 'Geist', data: bold, weight: 700 as const },
  ]
  await mkdir('public/brand', { recursive: true })
  const logo = new ImageResponse(<BrandMark size={512} tile="#141414" ink="#fff" />, { width: 512, height: 512 })
  const logoBytes = Buffer.from(await logo.arrayBuffer())
  await sharp(logoBytes).png().toFile('public/brand/logo-512.png')
  await sharp(logoBytes).resize(180, 180).flatten({ background: '#141414' }).png().toFile('app/apple-icon.png')

  for (const source of homeSources) {
    const svg = source.mark
      ? (await readFile('public/brands/' + source.mark + '.svg', 'utf8')).replace('<path ', '<path fill="' + colors[source.id] + '" ')
      : undefined
    const symbol = svg && 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
    for (const reply of [false, true]) {
      const card = new ImageResponse(preview(source, reply, symbol), { width: 648, height: 370, fonts })
      const bytes = Buffer.from(await card.arrayBuffer())
      await sharp(bytes).webp({ quality: 90 }).toFile('public/previews/' + source.id + (reply ? '-reply.webp' : '-request.webp'))
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
