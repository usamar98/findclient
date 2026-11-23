import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('faq')
export default function Page() {
  return <InfoPage slug="faq" />
}
