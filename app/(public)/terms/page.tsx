import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('terms')
export default function Page() {
  return <InfoPage slug="terms" />
}
