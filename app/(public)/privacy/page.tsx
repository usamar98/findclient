import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('privacy')
export default function Page() {
  return <InfoPage slug="privacy" />
}
