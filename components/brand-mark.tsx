import React from 'react'

/** Two conversation paths converge into a single forward arrow. */
const glyph = 'M5 8.5h5.5c5 0 8 2.5 10 6.5l1 2h4.2l-4.2-4.2L25.3 9 36.3 20l-11 11-3.8-3.8 4.2-4.2h-4.2l-1 2c-2 4-5 6.5-10 6.5H5v-5.2h5.5c2.8 0 4.3-1.4 5.5-3.7l1.3-2.6-1.3-2.6c-1.2-2.3-2.7-3.7-5.5-3.7H5z'

export function BrandMark({ size = 40, ink = 'currentColor', tile }: {
  size?: number
  ink?: string
  tile?: string
}) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40" fill="none">
      {tile && <rect width="40" height="40" rx="9" fill={tile} />}
      <path d={glyph} fill={ink} />
    </svg>
  )
}
