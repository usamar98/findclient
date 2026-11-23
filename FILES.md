# Clientfind file inventory

The application contains 126 source, configuration, content, and handoff files. Each path is relative to the project root. Shared files appear under their primary implementation phase.

## 1. Foundation

Next.js, React, Tailwind, shared UI, Supabase clients, authentication, and the initial migration. The migration also contains the credit, billing, delivery, and scheduling functions.

```text
.gitignore
app/auth/actions.ts
app/auth/callback/route.ts
app/auth/layout.tsx
app/auth/login/page.tsx
app/globals.css
app/layout.tsx
components.json
components/ui/button.tsx
lib/db/admin.ts
lib/db/schema.ts
lib/db/server.ts
lib/origin.ts
lib/secrets.ts
lib/utils.ts
middleware.ts
next.config.mjs
package-lock.json
package.json
postcss.config.mjs
supabase/migrations/20261123091957_clientfind.sql
tailwind.config.ts
tsconfig.json
```

## 2. Onboarding

Three-step niche creation, optional portfolio reading, AI suggestions, and editable source and keyword settings. The settings page also reuses the niche editor.

```text
app/app/niche-actions.ts
app/app/onboarding/page.tsx
components/workspace/niche-editor.tsx
lib/niche.ts
```

## 3. Lead discovery and credits

Public source adapters, provider cooldowns, bounded AI calls, durable scans, and cron routing. Credit reservations and settlement live in the shared migration.

```text
app/api/cron/[job]/route.ts
lib/ai.ts
lib/engine.ts
lib/sources/api.ts
lib/sources/discovery.ts
lib/sources/index.ts
lib/sources/shared.ts
vercel.json
```

## 4. Workspace

Inbox, lead detail, drafts, status changes, settings, loading states, and authenticated navigation.

```text
app/app/layout.tsx
app/app/leads/[id]/page.tsx
app/app/leads/actions.ts
app/app/loading.tsx
app/app/page.tsx
app/app/settings/actions.ts
app/app/settings/page.tsx
components/workspace/drafts.tsx
```

## 5. Notifications

React Email content, retryable delivery, and Telegram account linking. The shared cron route schedules the digest and outbox.

```text
app/api/telegram/webhook/route.ts
components/email/message.tsx
lib/notifications.tsx
```

## 6. Payments

Checkout, verified webhooks, idempotent fulfillment, pricing, billing continuation, and the Stripe portal.

```text
app/api/checkout/route.ts
app/api/portal/route.ts
app/api/stripe/webhook/route.ts
app/app/billing-status/page.tsx
app/app/checkout/[product]/page.tsx
lib/checkout.ts
lib/payments.ts
lib/pricing.ts
```

## 7. Public site

Marketing pages, navigation, product imagery, FAQs, pricing displays, and the public discovery demo.

```text
app/(public)/about/page.tsx
app/(public)/changelog/page.tsx
app/(public)/contact/page.tsx
app/(public)/faq/page.tsx
app/(public)/how-it-works/page.tsx
app/(public)/layout.tsx
app/(public)/marketing.css
app/(public)/page.tsx
app/(public)/pricing/page.tsx
app/(public)/privacy/page.tsx
app/(public)/terms/page.tsx
app/icon.tsx
components/marketing/info-page.tsx
components/marketing/offers.tsx
components/marketing/public-search.tsx
lib/demo-snapshot.ts
lib/marketing-faq.ts
lib/marketing-pages.ts
public/product-variants.webp
```

## 8. Search and content

Metadata, schema, crawler documents, feeds, social cards, ten niche pages, comparisons, three public tools, and five MDX guides.

```text
app/(public)/alternatives/gummysearch/page.tsx
app/(public)/blog/[slug]/opengraph-image.tsx
app/(public)/blog/[slug]/page.tsx
app/(public)/blog/guides.css
app/(public)/blog/layout.tsx
app/(public)/blog/page.tsx
app/(public)/find-clients/[niche]/page.tsx
app/(public)/tools/[tool]/page.tsx
app/(public)/tools/[tool]/tool.css
app/(public)/tools/actions.ts
app/(public)/vs/[competitor]/page.tsx
app/api/indexnow/route.ts
app/guides/[filename]/route.ts
app/indexnow-key.txt/route.ts
app/llms-full.txt/route.ts
app/llms.txt/route.ts
app/not-found.tsx
app/og/route.ts
app/opengraph-image.tsx
app/robots.ts
app/rss.xml/route.ts
app/sitemap-index.xml/route.ts
app/sitemap.ts
components/marketing/free-writer.tsx
components/marketing/post-body.tsx
components/marketing/seo.tsx
content/blog/best-gummysearch-alternatives.mdx
content/blog/helping-first-vs-cold-outreach.mdx
content/blog/how-to-find-shopify-clients-on-reddit.mdx
content/blog/how-to-write-a-forum-proposal.mdx
content/blog/subreddits-where-businesses-hire-freelancers.mdx
lib/brand.ts
lib/comparisons.ts
lib/free-tools.ts
lib/indexnow.ts
lib/llms.ts
lib/niche-content.ts
lib/posts.ts
lib/public-pages.ts
lib/seo.ts
lib/share-card.tsx
```

## 9. Quality and launch

Regression tests, illustrative seed data, environment template, setup instructions, and launch checklist.

```text
.env.example
FILES.md
README.md
app/error.tsx
eslint.config.mjs
lib/limits.ts
scripts/seed.ts
tests/ai.test.ts
tests/ledger.test.ts
tests/routing.test.ts
tests/sources.test.ts
tests/webhook.test.ts
```

## Local build output

Next.js generates `next-env.d.ts` and `.next/`. TypeScript generates `tsconfig.tsbuildinfo`. npm installs packages into `node_modules/`. The Supabase CLI stores local version data in `supabase/.temp/`. These paths are ignored by source control.
