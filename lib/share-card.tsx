import { ImageResponse } from 'next/og'
export const cardSize = { width: 1200, height: 630 }
export function shareCard(title: string) {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#141414',
        color: '#fff',
        flexDirection: 'column',
        padding: '64px 76px',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', fontSize: 33, alignItems: 'center' }}>
        <span
          style={{
            display: 'flex',
            width: 28,
            height: 28,
            border: '7px solid #eee',
            marginRight: 15,
            borderRadius: 8,
          }}
        />
        Clientfind
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 47 ? 64 : 79,
          lineHeight: 1.09,
          letterSpacing: '-0.055em',
          maxWidth: 1030,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 26, color: '#ccc' }}>
        Find public requests. Write a useful first reply.
      </div>
    </div>,
    {
      ...cardSize,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
    },
  )
}
