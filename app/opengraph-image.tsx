import { shareCard } from '@/lib/share-card'
export const alt = 'Lead To Client, the freelance lead finder at LeadToClient.app'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default function Image() {
  return shareCard('Find freelance clients asking for your help.')
}
