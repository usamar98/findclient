import { ImageResponse } from 'next/og'
import { BrandMark } from '@/components/brand-mark'

export const cardSize = { width: 1200, height: 630 }

export function shareCard(title: string) {
  return new ImageResponse(
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      padding: '56px 72px 46px', justifyContent: 'space-between',
      background: '#fafafa', color: '#131313',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 35, fontWeight: 700, letterSpacing: '-1.6px' }}>
        <BrandMark size={62} tile="#141414" ink="#fff" />
        <span style={{ marginLeft: 16 }}>Lead To Client</span>
      </div>
      <div style={{
        display: 'flex', fontSize: title.length > 56 ? 68 : 80, fontWeight: 700,
        lineHeight: 1.02, letterSpacing: '-4px', maxWidth: 1010,
      }}>{title}</div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '2px solid #d7d7d7', paddingTop: 22, fontSize: 24,
      }}>
        <span>LeadToClient.app</span>
        <span>Freelance lead discovery</span>
      </div>
    </div>,
    { ...cardSize, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } },
  )
}
