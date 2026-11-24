import { ImageResponse } from 'next/og'
import { BrandMark } from '@/components/brand-mark'

export const size = { width: 96, height: 96 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(<BrandMark size={96} tile="#141414" ink="#fff" />, size)
}
