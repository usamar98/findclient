import { shareCard } from '@/lib/share-card'
export const alt = 'Clientfind — find clients asking for help'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default function Image() {
  return shareCard('Find clients asking for help today')
}
