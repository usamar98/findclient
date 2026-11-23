import { InfoPage, infoMetadata } from '@/components/marketing/info-page'

export const generateMetadata = () => infoMetadata('contact')
export default function Page() {
  return <InfoPage slug="contact" />
}
