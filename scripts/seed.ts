import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const demoSkill = 'Shopify theme development (demo)'
const examples = [
  {
    slug: 'product-template',
    title: 'Display a different size guide on two product templates',
    body: 'A fictional apparel merchant wants a distinct size chart on each template and has asked for a scoped implementation.',
    intent_score: 76,
    intent_reason:
      'The illustrative request names a deliverable and asks for implementation.',
    problem_summary:
      'Separate the size guides and verify both product templates in a theme preview.',
    budget_signal: 'Budget unspecified',
    urgency: 'This week',
    status: 'new',
  },
  {
    slug: 'collection-navigation',
    title: 'Review collection navigation before a store launch',
    body: 'A fictional merchant asks for a mobile navigation review and a short list of fixes before a seasonal collection release.',
    intent_score: 74,
    intent_reason:
      'The example describes a release date and asks for a defined review.',
    problem_summary:
      'Review collection navigation at mobile widths and document reproducible issues.',
    budget_signal: 'Asking for a quote',
    urgency: 'Before launch',
    status: 'saved',
  },
  {
    slug: 'variant-images',
    title: 'Correct a product photo when the selected variant changes',
    body: 'A fictional store owner has asked for help reproducing a product gallery issue on two named variants.',
    intent_score: 70,
    intent_reason:
      'The example includes a reproducible symptom and an invitation to help.',
    problem_summary:
      'Compare the two variants in preview and verify which media is assigned to each.',
    budget_signal: 'Budget unspecified',
    urgency: 'Flexible',
    status: 'replied',
  },
]

async function main() {
  const [flag, target, ...extra] = process.argv.slice(2)
  if (flag !== '--user' || !target || extra.length) {
    throw new Error(
      'Usage: tsx scripts/seed.ts --user <existing-demo-user-uuid>',
    )
  }
  const userId = z.uuid().parse(target)
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    })
    .parse(process.env)
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile)
    throw new Error(
      'Create and sign in to the intended demo account before seeding it.',
    )

  const findNiche = async () => {
    const { data, error } = await db
      .from('niches')
      .select('id')
      .eq('user_id', userId)
      .eq('skill', demoSkill)
      .eq('active', false)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.id as string | undefined
  }
  let nicheId = await findNiche()
  if (!nicheId) {
    const { data, error } = await db.rpc('save_niche', {
      p_user: userId,
      p_id: null,
      p_data: {
        skill: demoSkill,
        keywords: ['theme', 'variant', 'template'],
        negative_keywords: [],
        sources: ['shopify'],
        min_intent: 65,
        active: false,
        portfolio_url: null,
        pitch_style: '',
      },
    })
    if (error) {
      nicheId = await findNiche()
      if (!nicheId) throw error
    } else {
      nicheId = z.uuid().parse(data)
    }
  }

  const createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const records = examples.map(({ slug, ...example }) => ({
    ...example,
    title: '[Demo] ' + example.title,
    source: 'shopify',
    url: 'https://example.org/#clientfind-demo-' + slug,
    author: 'Fictional demo merchant',
    user_id: userId,
    niche_id: nicheId,
    posted_at: createdAt,
    created_at: createdAt,
  }))
  const { error } = await db.from('leads').upsert(records, {
    onConflict: 'user_id,url',
    ignoreDuplicates: true,
  })
  if (error) throw error
  console.log(
    'Demo leads are available in the specified account. The demo niche is inactive.',
  )
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Seed failed. Check database permissions and migration status.',
  )
  process.exitCode = 1
})
