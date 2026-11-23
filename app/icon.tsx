import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: 64,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        background: '#141414',
        color: '#fff',
        gap: 5,
      }}
    >
      {[16, 28, 38].map((height, index) => (
        <span key={height} style={{ display: 'flex', background: 'white',
          width: 7, height, borderRadius: 2, transform: 'rotate(20deg)',
          marginTop: (1 - index) * 11 }} />
      ))}
    </div>,
    size,
  )
}
