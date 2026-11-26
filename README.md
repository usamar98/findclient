# Lead To Client

Lead To Client helps freelancers and small agencies find public requests for their services, qualify leads, draft replies and track proposals and won revenue. The user reviews each reply and posts it in the original conversation. The production domain is [leadtoclient.app](https://leadtoclient.app).

## Local setup

Use Node.js 22 and npm. From this directory, run:

```powershell
npm ci --include=dev
Copy-Item .env.example .env.local
npm run dev
```

Open [the local site](http://localhost:3000). A fresh checkout can build the marketing pages before service credentials are available. The workspace uses Supabase. The discovery worker uses OpenAI when available and can assess explicit hiring language locally after the scan recovery migration. Indexed web sources require a search provider key.

The [environment template](.env.example) lists every application setting. The [file inventory](FILES.md) groups the delivered files by implementation phase. Configure secrets in the server environment. Production metadata, the sitemap, RSS, and public guide links use https://leadtoclient.app. Set `NEXT_PUBLIC_SITE_URL=https://leadtoclient.app` in production for sign-in and checkout. Local development and Vercel previews request exclusion from search. Vercel supplies `VERCEL`, `VERCEL_URL` and `VERCEL_ENV` automatically. Next.js sets `NODE_ENV`. Use separate service keys for preview and production.

## Environment variables

| Feature | Variables | When to set them |
| --- | --- | --- |
| Canonical origin | `NEXT_PUBLIC_SITE_URL` | Use https://leadtoclient.app for production. Configure preview and local origins separately. |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required for authenticated accounts, the database, shared rate limits and live pricing. |
| AI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION`, `AI_MAX_USD_PER_CREDIT` | The key enables generation. The default model and cost guard have built-in settings. Set both rates for another model. |
| Discovery | `EXA_API_KEY`, `STACK_EXCHANGE_KEY` | Exa enables indexed Reddit, X, Indie Hackers and forum results. The Stack Exchange key increases the available quota. |
| Optional direct Reddit and X live search | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, `X_BEARER_TOKEN` | Use credentials for a Reddit app approved for your use and a descriptive user agent identifying its operator. The X app needs recent-search access. Without these, live research uses Exa on those platforms when configured. |
| Website audits | `PAGESPEED_API_KEY` | Optional Google PageSpeed Insights key for mobile Lighthouse metrics and rendered accessibility findings. Basic HTML audits run without a key. |
| Checkout | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Required for purchases and signed fulfillment. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Required for transactional messages and opted-in digests. |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Required for account linking and private lead alerts. |
| Scheduled jobs | `CRON_SECRET` | Authorizes Vercel jobs and IndexNow submission. |
| Brand and contact | `FOUNDER_NAME`, `FOUNDER_URL`, `BRAND_X_URL`, `BRAND_GITHUB_URL`, `BRAND_PRODUCT_HUNT_URL`, `BRAND_LINKEDIN_URL`, `NEXT_PUBLIC_TWITTER_HANDLE`, `SUPPORT_EMAIL` | Add the real public identity, official profiles and monitored contact address for launch. |
| Indexing | `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `INDEXNOW_KEY` | Use the verification tokens issued by Google and Bing when verifying via HTML. The site serves its public IndexNow ownership key at `/indexnow-key.txt`. Optionally override it with 8–128 letters, digits or hyphens. |
| Traffic tracker | `TRUSTMRR_SCRIPT_URL`, `TRUSTMRR_WEBSITE_ID` | Copy the values from the official snippet, or paste it once into the slot in `app/(public)/layout.tsx`. |

## Database and sign-in

1. Select the Supabase project intended for Lead To Client. In its SQL Editor run the pending [migrations](supabase/migrations) in filename order. For the CLI workflow, run `npx supabase init` to create the local configuration, `npx supabase link --project-ref <project-ref>`, and `npx supabase db push`.
2. Copy the project URL, publishable key and server-only service key into their matching environment variables. The SQL grants reads and limited updates to authenticated users under RLS. Financial writes, outbox delivery, scanning and niche limits use server-side RPCs.
3. Enable Email and Google in Supabase Auth. Set the production Site URL to https://leadtoclient.app and allow-list the exact `/auth/callback` URLs used by development, preview and production. In Google Cloud create a Web application OAuth client. Add Supabase’s displayed callback (normally `https://<project-ref>.supabase.co/auth/v1/callback`) to its authorized redirect URIs, then enter the client ID and secret in the Supabase Google provider settings. For an external Google consent screen in testing, add the accounts you will use to test. On `/auth/signup`, email requests can create an account. On `/auth/login`, email requests sign in existing accounts. Google works on both screens.
4. Use Supabase SMTP settings with a verified sender for production magic links. The app handles the default PKCE code exchange. To support opening an email link in another browser, use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` as the link in the Supabase email template. The app supplies the callback URL without query parameters.
5. Sign in, choose a skill, optionally add a public HTTPS portfolio, review the suggested phrases, and enable sources. New accounts start with zero credits. Lifetime access or a one-time credit pack funds discovery and drafts. A portfolio excerpt goes through Jina Reader and OpenAI. Keywords remain editable when suggestions are unavailable.

To add three illustrative leads to a specific existing demo account, run `npm run seed -- --user <demo-user-uuid>`. The seed creates an inactive niche, respects the plan limit and labels every example. Running the command twice keeps a single copy of each lead.

## Leads, credits and pricing

For an existing installation with the November 23–24 database migrations, run the [workspace upgrade SQL](docs/downloads/lead-to-client-workspace-upgrade.sql) once in the Supabase SQL Editor before deploying this version. The upgrade uses the existing scan and notification jobs and the existing provider keys.

Then apply the [scan recovery SQL](docs/downloads/lead-to-client-scan-recovery.sql) once. An installation that already has scan receipts needs only this incremental file. A manual scan can continue from its receipt within its six-hour retry window, sharing its original credit cap. Receipts distinguish AI scores, free local assessments, source cooldowns and processing failures.

Live research at `/app/research` defaults to the past 15 minutes on platforms that work without operator credentials. It searches for the service and relevant problem descriptions, shows the author's request alongside the original post, and lists topical discussions separately. Platform coverage reports how many fresh candidates were reviewed and whether a feed or search returned partial results. Results use the original publication time as of the displayed check. Users can opt to repeat a one- or 15-minute search of keyless sources once a minute while the tab is visible. Changing the search stops these checks. Indexed sources can lag behind publication. Research uses no scoring credits and does not add posts to the lead inbox.

The **Paid freelance jobs** preset includes contracts from We Work Remotely and Remote OK, maintainer-offered cash bounties on open GitHub issues, and public Mastodon hiring posts. Leave keywords empty to browse all qualifying openings in the selected window. The results link back to the original platform, show published pay where available, and report total search time and elapsed time per source. The platform timers can overlap because independent platforms run in parallel. Board publication times and refresh intervals vary. We Work Remotely requests an hourly refresh of its RSS feed.

A signed-in user can submit 10 searches in 10 minutes and make 40 metered source requests per 24-hour window. The project-wide limit is 100 metered requests per 24-hour window. Adjust it with `LIVE_RESEARCH_DAILY_PROVIDER_LIMIT`, or set it to zero to use only unmetered sources. Upstream API charges and limits apply to the operator's credentials.

After signing in, open the dashboard at `/app` for leads, follow-ups and workspace operations. The Lead inbox at `/app/inbox` supports selecting multiple sources in one search. Profile, Pricing, Settings and Sign out are available from Account.

Workspace owners can open **Scans** to run a saved search immediately and cap the total credits it can use, including any automatic reply drafts its matches trigger. Each source has a receipt showing posts found, scored, and matched, draft activity, and the credits used. Manual runs also work when the search's schedule is off. The same page sets each search's monthly scoring budget and the workspace's reply reserve. Both manual and scheduled scans use these controls. The monthly accounting window begins at midnight UTC on the first of the month. The lifetime plan continues to refill on its purchase anniversary each month.

In **Automations**, owners can assign qualifying leads to teammates, prepare a reply for review, and request a Telegram alert. A generated reply uses one credit. The first recorded visit to a newly opened proposal can notify the owner and schedule an editable follow-up. The notifications cron prepares due drafts, and a call booking, a closed deal, or a revoked link stops the sequence. Email delivery uses the existing Resend configuration.

**Results** groups leads, recorded replies, booked calls, wins, and won revenue by platform or saved search. Owners also see the scoring and drafting credits spent. Older charges that cannot be linked to a surviving request appear under Unattributed.

Fast discovery checks Hacker News, Bluesky and Shopify Community every ten minutes when enabled. Other sources are searched hourly. Each service search can watch specific Hacker News threads and Reddit communities. Lead details distinguish buying intent from buyer quality and show source evidence, detection time and source availability where known. Feedback helps tune future matches.

The shared inbox supports invitations, assignments, follow-up emails, proposal stages and recorded won revenue in USD. Website checks use the site identified in the request, a website listed on a matched source profile when available, or a site entered by a teammate. Workers check speed, SEO and mobile markup, honor robots rules and skip private network destinations. The optional PageSpeed integration adds rendered mobile findings. New drafts use completed findings, the niche’s portfolio style and the author’s optional writing examples. Opting in also uses recent human edits in the same workspace.

Use the lead’s proposal editor to set branding, scope, packages, currency and timelines. Download a PDF or publish a revocable link. The editor shows opens of the published page. Share links expose only the published proposal snapshot.

Each scored request and each reply generation uses one credit. Rejected scores still involve an AI call. Credit reservation, settlement and result persistence run inside database transactions. The maintenance job refunds pending work older than 30 minutes, including interruptions during serverless execution.

| Offer | Price | Credits | Niche limit |
| --- | --- | --- | --- |
| Lifetime deal | $149 for the first 10 completed deals, then $10 more after each 10 | 150 at purchase and 150 each month | 3 |
| Credit packs | $9, $19, $29 | 100, 250, 400 respectively | Existing plan |

The lifetime campaign accepts new reservations through December 16, 2026 in Asia/Karachi. A buyer with an existing Stripe session can finish at the reserved price until that session expires. The public sales counter uses completed lifetime purchases. Unspent credits carry forward. Existing monthly subscribers keep their one-niche allowance and credits for each paid period. Existing lifetime agency purchases keep their original allowance and niche limit.

Each AI call must fit both `AI_MAX_USD_PER_CREDIT` and half the price of one credit in the cheapest configured top-up. The estimate includes the maximum output tokens, input bytes and an allowance for message framing. Set current token rates when changing models. A one-time purchase with unlimited future refills has no fixed maximum lifetime cost. Search queries, free accounts, payment fees, hosting and notification delivery also affect margins.

## Stripe, email and Telegram

- After deploying, add `STRIPE_SECRET_KEY` to the deployment's server environment. In Stripe Workbench create an HTTPS snapshot event destination at `https://leadtoclient.app/api/stripe/webhook` for your own account using API version `2025-08-27.basil` (the installed Stripe SDK version). Select `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `customer.subscription.updated`, and `customer.subscription.deleted`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy. Keep test and live keys and endpoints in their respective environments.
- Enable cancellation, payment method updates and invoice history in the Stripe customer portal. New checkouts use a one-time USD price from the database quote. For existing subscriptions, each paid invoice credits the account once, including renewals. The portal cancellation policy determines when the subscription ends. A failed renewal grants no credits.
- Verify a sending domain in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`. New accounts, paid purchases and low-credit threshold crossings enqueue emails. A daily digest includes up to five leads for opted-in users. The outbox retries failed deliveries and uses Resend idempotency keys.
- Create a Telegram bot and set its token and username. Choose a strong webhook secret accepted by Telegram. Register the HTTPS URL `/api/telegram/webhook` with Bot API `setWebhook` and supply the same `secret_token`. Users click **Connect my Telegram account** in Settings and start the bot in a private chat. Each connection code expires after ten minutes and is consumed once.
- Priority alerts use the configured intent threshold. Teams can connect Telegram or supported Slack, Zapier, Make and n8n Cloud webhook destinations in Settings. Resend handles optional priority email and scheduled follow-up reminders. External delivery is at least once.

## Vercel schedules

Set `CRON_SECRET` on Vercel Pro. Vercel sends it in an Authorization bearer header. Schedules use UTC and are defined in [vercel.json](vercel.json).

| Route | Schedule | Work |
| --- | --- | --- |
| `/api/cron/scan` | Every ten minutes | Enqueue due source searches and run intent scoring |
| `/api/cron/site-audits` | Every five minutes | Claim queued buyer website checks |
| `/api/cron/continue-scan` | Every minute | Claim queued niche/source jobs, honor provider backoff and resume interrupted work |
| `/api/cron/notifications` | Every minute | Deliver queued email and Telegram alerts |
| `/api/cron/digest` | 08:00 daily | Queue each opted-in user’s top leads |
| `/api/cron/maintenance` | Hourly at minute 15 | Apply due monthly refills, recover interrupted credits and reconcile expired checkout quotes |

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

The SQL tests execute the migration with PGlite and a small Supabase Auth role fixture. They cover RLS, column grants, exhausted balances, duplicate charges, refunds, interrupted work, current price tiers, reservations and replayed fulfillment. The webhook tests use Stripe-generated signatures. Live provider setup requires the corresponding account credentials.

### Local release checks on November 23, 2026

The integrated release passed lint, TypeScript checking, the Next.js production build and all 19 automated tests. The dependency audit reported zero known vulnerabilities. Four read-only source checks returned recent posts from Hacker News, Bluesky, Stack Overflow and Shopify Community. Indexed search and paid services still require their production credentials.

The configured-origin crawl checked 33 public HTML pages, their initial metadata, canonical URLs, 40–60-word answers, structured data, internal links, five Markdown guides, RSS and the sitemap. Browser checks covered the homepage demo, three Reddit sample links, editing and copying both writing-tool drafts, checkout sign-in continuation, FAQ expansion and eight mobile layouts.

| Mobile Lighthouse 12.8.2 | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Homepage | 98 | 100 | 100 | 100 | 2.2 s | 0 |
| Pricing | 99 | 100 | 100 | 100 | 2.1 s | 0 |
| Shopify Reddit guide | 100 | 100 | 100 | 100 | 1.8 s | 0 |

These measurements used the optimized production build on localhost with a temporary canonical origin, simulated mobile throttling and the traffic tracker disabled. The final deployment, database latency, tracker and real-user devices can change the results.

## Launch checklist

For the verified Google property and other search platforms, use the [submission guide](docs/search-submission.md) and [downloadable launch files](docs/downloads/lead-to-client-search-pack-2026-11-24.zip). Google and Bing read the current sitemap at [leadtoclient.app/sitemap.xml](https://leadtoclient.app/sitemap.xml).

The November 24, 2026 rebrand was checked against a local production build. All 35 sitemap pages were reachable through links from the homepage and had canonical links, distinct titles and descriptions, and working social previews. The six Markdown guides linked to their canonical articles. The FAQ showed 30 answers matching its structured data. Mobile and desktop checks covered the new wordmark, navigation, theme control and service directory. These checks cover the application build. Production HTTPS, domain ownership verification and search-engine submission are tracked below.

- [ ] Link the existing Lead To Client deployment project in the intended Vercel Pro team using an account with project creation or deployment access. Use the Next.js preset, Node 22, `npm ci --include=dev` for install and `npm run build` for build. Supply environment variables at the proper scope and redeploy.
- [ ] Apply the Supabase migration, enable auth providers and verify a magic link and Google login. Check that one user cannot read another user’s leads.
- [ ] Set the AI and external search keys, verify a recent result from each enabled source, and run an authenticated hourly scan. Check a charge, a below-threshold result and an edited draft.
- [ ] Configure Stripe webhook events and the customer portal. In test mode complete a lifetime purchase and a credit top-up, then replay the events. Verify the credits, plan, billing history and lifetime tier counter. For an existing test subscription, verify renewal and cancellation.
- [ ] Verify a Resend sender and confirm one welcome email and one opted-in digest. Connect the Telegram bot, link an account and confirm an alert from a qualifying lead.
- [ ] Add the Ship or Die / TrustMRR tracker using the public layout’s single script slot. Connect TrustMRR in the provider dashboard. Check the tracker loads once on a public page.
- [ ] Add the founder details, official brand profile links and monitored support email. Review the published privacy terms against the services enabled for launch.
- [ ] Connect leadtoclient.app and www.leadtoclient.app to the production deployment, confirm HTTPS works for both, set the full origin, and register https://leadtoclient.app/auth/callback with Supabase Auth. Verify the host redirect, private route headers and public indexing rules.
- [ ] Verify domain ownership in Google Search Console and Bing Webmaster Tools. Submit `/sitemap.xml` to both. Check that the live IndexNow key file returns HTTP 200 before notifying participating engines about new or changed pages.
- [ ] Test the deployed pages with [Google Rich Results Test](https://search.google.com/test/rich-results) and [PageSpeed Insights](https://pagespeed.web.dev/). Verify canonical links, card images, JSON-LD, `robots.txt`, RSS, `llms.txt` and `llms-full.txt` using the final domain.

After deployment, the following PowerShell command submits the published URLs to IndexNow. Load the production origin and cron secret into the shell environment first. A response with `accepted: true` confirms receipt. The provider may still need to verify the ownership key. For subsequent updates, send just the changed paths in the request body.

```powershell
Invoke-RestMethod -Method Post -Uri "$env:NEXT_PUBLIC_SITE_URL/api/indexnow" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" } -ContentType 'application/json' -Body '{}'
```
