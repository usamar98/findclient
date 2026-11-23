import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('changelog')
export default function Page() {
  return <InfoPage slug="changelog" />
}
