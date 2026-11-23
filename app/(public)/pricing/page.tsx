import { Offers } from '@/components/marketing/offers'
import { Breadcrumbs, FAQ } from '@/components/marketing/seo'
import { marketingFaq } from '@/lib/marketing-faq'
import { infoPages } from '@/lib/marketing-pages'
import { buildMetadata } from '@/lib/seo'
export const dynamic = 'force-dynamic'

export const generateMetadata = () => buildMetadata({ ...infoPages.pricing, path: '/pricing' })
export default function Page() {
  return (
    <main className="cf-pricing-page">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Pricing', href: '/pricing' }]} />
      <Offers full />
      <div className="cf-pricing-faq">
        <FAQ title="Pricing questions" items={marketingFaq.slice(15, 20)} />
      </div>
    </main>
  )
}
