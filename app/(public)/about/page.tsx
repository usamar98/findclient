import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('about')
export default function Page() {
  return <InfoPage slug="about" />
}
