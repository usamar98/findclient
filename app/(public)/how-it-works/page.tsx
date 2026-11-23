import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('how-it-works')
export default function Page() {
  return <InfoPage slug="how-it-works" />
}
