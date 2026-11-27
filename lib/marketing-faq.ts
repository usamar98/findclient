import { coverageIntro, freshnessAnswer } from './marketing-coverage'
import { lifetimeLastDay } from './offers'
import {
  platformFreshnessAnswer,
  platformGuideRows,
  platformRuntimeAnswer,
  platformTimingNote,
  platformWatchAnswer,
} from './platform-guide'

export type MarketingFaqItem = {
  question: string
  answer: string
  introduction?: string
  sources?: typeof platformGuideRows
}

type FaqGroup = { id: string; title: string; items: MarketingFaqItem[] }

function qa(question: string, answer: string): MarketingFaqItem {
  return { question, answer }
}

const reddit = qa(
  'Where do Reddit freelance leads come from?',
  'Live Research searches public Reddit threads directly when Lead To Client has approved Reddit API access. It can also use the Exa search index when configured. Saved Reddit scans use Exa. Check Platform coverage after a live search to see which route ran, then open the original subreddit thread to read the hiring request.',
)
const publishing = qa(
  'Does Lead To Client post pitches or send direct messages for me?',
  'You decide what to publish. Edit the suggested reply, open the original thread and use the contact method the buyer requested. A hiring rule can prepare a draft for review while you work on something else.',
)
const intentScore = qa(
  'What does the minimum intent score mean for a freelance lead?',
  'Intent is a 0–100 estimate of how closely a post signals demand for your service. Set a minimum in your saved search to control which scored leads enter the inbox. Open a scored lead to read the reason and compare it with the buyer’s original words.',
)
const creditCost = qa(
  'How many freelance leads can I research with 150 credits?',
  'A Live Research search uses zero scoring credits. In a saved scan, an AI assessment costs one credit per post, including a post that falls below your minimum score. A reply draft or regeneration costs one more. For example, you could spend 150 credits on 120 AI assessments and 30 drafts. The number of leads that qualify depends on what the posts say.',
)
const payingClients = qa(
  'Does spending a credit guarantee a paying client?',
  'A credit pays for an AI assessment or a reply draft. The buyer decides whom to hire. Check the original request for a budget, an open project and a way to apply before spending time on a proposal.',
)
const lifetimeOffer = qa(
  'How does the Lead To Client lifetime deal work?',
  `The first ten lifetime deals start at $149 each. The price increases by $10 after each ten completed deals. The final day to buy is ${lifetimeLastDay}, through 11:59 PM Pakistan time. Lifetime access includes three saved service searches and a shared monthly credit refill. The pricing page shows the current offer.`,
)
const carryOver = qa(
  'Do unused credits carry over?',
  'Yes. Unused credits stay in the workspace when the lifetime allowance refills or you purchase a one-time pack. Open Account and select Profile to see your remaining points.',
)
const creditPacks = qa(
  'Can I buy more credits for a busy month?',
  'One-time credit packs are available on the pricing page. Select a pack and check its credit quantity and total in Stripe Checkout before purchasing.',
)

export const liveResearchTimingFaq: MarketingFaqItem[] = [
  qa('How does the 15-minute filter find fresh freelance leads?', platformFreshnessAnswer),
  qa('How do I enable the 1-minute recheck in Live Research?', platformWatchAnswer),
  {
    question: 'How fresh are freelance leads from each source?',
    answer: [platformTimingNote, ...platformGuideRows.map(row => row.name + '. ' + row.freshness)].join(' '),
    introduction: platformTimingNote,
    sources: platformGuideRows,
  },
]

export const faqGroups: FaqGroup[] = [
  {
    id: 'finding-freelance-work',
    title: 'Finding freelance work',
    items: [
      qa('How does Lead To Client find freelance leads?',
        'Use Live Research to search recent community posts and freelance openings by skill. For ongoing discovery, save your service, buyer phrases and sources, then run a scan. Qualifying posts arrive in the lead inbox with a reason to review them and a link to the original conversation.'),
      qa('Where can I find freelance jobs posted in the last 24 hours?',
        'Open 24-hour Jobs to browse Hacker News, Bluesky, Mastodon, We Work Remotely, Remote OK and GitHub paid bounties. Filter by a skill, choose a single source or browse them together. Each opening links to its original listing so you can check whether the buyer is still accepting applications.'),
      qa('Can I browse paid freelance jobs without a keyword?',
        'Yes. In Live Research, leave Keywords blank and select any combination of We Work Remotely, Remote OK, GitHub paid bounties and Mastodon hiring posts. Choose a publication window and run the search. Including a community source such as Hacker News or Bluesky in Live Research requires a keyword.'),
      qa('How do I start looking for clients before setting up a saved search?',
        'Sign in, open Live Research, enter a skill or project phrase and choose your platforms and time window. For example, try “landing page” on Bluesky. You can run another search with different words right away. Save a service search when you want to monitor the same kind of work over time.'),
      qa('How can I tell a hiring post from a request for free advice?',
        'Live Research labels hiring requests, help requests and related discussions. Read the original wording. “What causes this checkout error?” asks for advice. “Can someone quote to fix our checkout before Friday?” gives you a deliverable, a deadline and an invitation to discuss paid work.'),
      qa('Where are the budget and hourly rate on a freelance job?',
        'Look for Listed pay on the job card. It shows compensation found in the source listing. An employer can offer a contract without publishing a rate. Those listings can show “Contract · Pay not listed”. Confirm the currency, scope and payment terms with the buyer before quoting.'),
    ],
  },
  {
    id: 'freelance-niches',
    title: 'Freelance services and client niches',
    items: [
      qa('Which freelancers and agencies does Lead To Client serve?',
        'The ten service presets cover Shopify developers, Shopify designers, web designers, SEO freelancers, video editors, copywriters, WordPress developers, Webflow developers, UI/UX designers and marketing agencies. Choose a preset when you create a saved search, or enter the service you sell in your own words.'),
      qa('Where can a Bubble developer find paid marketplace or MVP projects?',
        'Choose Public forums in Live Research to include Bubble Forum posts. Try buyer phrases such as “take over our Bubble app” or “build a marketplace”. A brief that names a milestone, payments integration or fixed budget is worth opening. For repeat searches, enter Bubble developer as a custom service.'),
      qa('Can n8n or HubSpot consultants search for automation projects?',
        'Yes. Create a custom service such as workflow automation or CRM migration. Search supported sources for buyer language like “hire an n8n consultant”, “migrate our HubSpot contacts” or “connect our CRM”. The Public forums source covers Bubble, WordPress support and Webflow. The dedicated n8n, Make and HubSpot job boards are outside that feed.'),
      qa('What should a freelance DevOps engineer search for?',
        'Use a custom DevOps service and look for a time-bound project such as “migrate our AWS infrastructure”, “Terraform contractor” or “set up our deployment pipeline”. Start with Hacker News, Bluesky and remote contract listings. Read the employment terms to check whether the buyer accepts contractors.'),
      qa('How can a freelancer use a portfolio to suggest search keywords?',
        'In the service search editor, enter the service and, optionally, a public HTTPS portfolio URL. Choose Suggest keywords to get initial buyer phrases and exclusions. Edit the suggestions against the projects you actually want. You can also enter every phrase yourself.'),
    ],
  },
  {
    id: 'platforms',
    title: 'Platforms and source coverage',
    items: [
      qa('Which freelance lead sources work without an API key or Exa?',
        'Nine Live Research sources work without a source API key or Exa. They are Hacker News, Bluesky, Stack Overflow, Shopify Community, selected public forums, We Work Remotely, Remote OK, GitHub paid bounties and Mastodon hiring posts. Reddit and X can use configured direct access or Exa. Indie Hackers uses Exa.'),
      reddit,
      qa('How can I find Shopify merchants requesting freelance help?',
        'Select Shopify Community and search for the task a merchant might describe, such as “checkout redirect” or “theme migration”. Open the matching topic or reply to see what the merchant has tried and whether they invite paid help. You can also choose Shopify Community in a saved service search.'),
      qa('Can Hacker News comments turn up freelance projects?',
        'Yes. A public Hacker News comment can contain an employer’s contract brief even when the parent thread is several weeks old. Live Research uses the comment’s own publication time. You can also add specific Hacker News thread IDs or item links to a saved search.'),
      qa('Can I monitor Bluesky and X for freelance work?',
        'Bluesky uses its public post search. Live Research can search X directly when the app has X API access, or use the Exa index when configured. Saved searches on X use the index. Look in Platform coverage for the method and result of a particular search.'),
      qa('Which GitHub issues qualify as paid bounties?',
        'Lead To Client looks for an open, unassigned GitHub issue where a repository owner, member or collaborator offers a specific cash amount for a deliverable. A “help wanted” label alone is insufficient. Read the original issue for acceptance criteria and claiming instructions.'),
      qa('Which Mastodon posts can appear as freelance jobs?',
        'Lead To Client checks selected hiring tags visible on mastodon.social for original public posts from accounts that allow indexing. A post from another Mastodon server can appear after it reaches that timeline. Open the post to check the author’s instructions.'),
      qa('Does Lead To Client include Upwork jobs?',
        'Upwork is outside the current source list. For paid freelance work, use the 24-hour Jobs feed to browse contracts, paid GitHub bounties and public hiring posts. Every listing opens on the platform where it was published.'),
    ],
  },
  {
    id: 'source-freshness',
    title: 'Freshness, timestamps and the 15-minute filter',
    items: [
      ...liveResearchTimingFaq,
      qa('What do Posted, First found and search runtime mean?', platformRuntimeAnswer),
      qa('Why did a live search return zero freelance leads?',
        'Open Platform coverage to see which sources responded, how many fresh posts were checked and whether a provider was unavailable or rate limited. If checks completed, try a broader project phrase or a longer window. A matching post must have a precise publication time inside your selected window.'),
    ],
  },
  {
    id: 'saved-searches',
    title: 'Saved searches and scan receipts',
    items: [
      qa('Does applying inbox filters start a new search?',
        'Inbox filters narrow the leads already saved in your workspace. Use Search posts in Live Research to check current posts, or Scan now under Scans to run an existing service search with a credit cap.'),
      qa('How do I search for leads again using the same service?',
        'Open Scans, select your saved service and run Scan now. Your keywords, platforms and minimum intent score are already saved. Edit those choices under Settings when you want to change what future scans look for.'),
      qa('How recent are the leads in my saved searches?', freshnessAnswer),
      qa('How often do saved community searches check for new leads?', coverageIntro),
      qa('What keywords help find buyers looking to hire a freelancer?',
        'Combine a buyer’s task with a product, deliverable or deadline. A copywriter might try “rewrite our onboarding emails”. A WordPress developer might try “migrate our membership site”. Review what each phrase brings in and keep the ones that uncover the work you want to sell.'),
      qa('What is a negative keyword in a saved lead search?',
        'A negative keyword excludes posts containing an unwanted phrase. For example, a video editor looking for paying clients might exclude “looking for an internship” after seeing repeated job-seeker introductions. Choose narrow exclusions so a useful buyer brief can still qualify.'),
      qa('What do found, scored and matched mean on a scan receipt?',
        'Found counts posts retrieved from a source. Scored counts posts the scan assessed. Matched counts posts that qualified for the inbox. Open the receipt to see the numbers, credit usage and progress for each platform. A post can be assessed and fall below the minimum intent score.'),
      qa('How do I narrow a lead search to a subreddit or Hacker News thread?',
        'Edit the saved search and add the subreddit name or Hacker News thread ID in the corresponding source settings. For Hacker News you can also paste the item link. This is useful when the work you want appears repeatedly in a particular community or hiring thread.'),
    ],
  },
  {
    id: 'buyer-intent',
    title: 'Hiring intent and buyer quality',
    items: [
      qa('What makes a freelance lead worth replying to?',
        'Look for a specific deliverable, a person able to hire and evidence that the project is current. A deadline, budget or named business can help. Before replying, open the thread to see whether the work is still available and how the buyer wants to be contacted.'),
      intentScore,
      qa('How can I reduce low-quality matches?',
        'Raise the minimum intent score in the saved search, tighten phrases that pull in general discussions and add exclusions for repeated false matches. Check the evidence on a scored lead and use the match feedback control to tell Lead To Client what was useful.'),
      qa('What does the buyer quality score measure?',
        'Buyer quality is a separate 0–100 score based on evidence of a hiring request, budget, an existing business or website, urgency and account age where available. The lead shows what the assessment used. An unknown budget or account age is a detail to check before you quote.'),
      qa('Can I audit a potential client’s website before writing a pitch?',
        'Open Website on the lead and check the public business URL, or add the website the buyer shared. The audit checks response speed, search metadata and mobile layout markup. A completed audit can supply a specific observation for your next reply draft. Some reports also include a mobile Lighthouse check.'),
    ],
  },
  {
    id: 'applications-and-replies',
    title: 'Applying and writing a first reply',
    items: [
      qa('How do I apply for a freelance job I found in Lead To Client?',
        'Select Apply on a hiring result in Live Research or on a listing in 24-hour Jobs. The original listing opens in a new tab. Follow the buyer’s application instructions there. When you finish, return to Lead To Client and choose Mark as applied to keep a record.'),
      qa('How can I save a job before I have time to apply?',
        'Select Save to inbox on a hiring result. You can return to the original listing, add a follow-up date and record the application later. If you have already submitted an application, Mark as applied also saves the job to your inbox.'),
      publishing,
      qa('What does an AI reply draft include?',
        'The draft includes a suggested answer to the buyer’s problem and a short pitch you can personalize. Check the advice against the original post, add a relevant example from your work and confirm you can deliver what you offer.'),
      qa('Can I edit or regenerate a reply draft?',
        'Yes. Choose a friendly, expert or short tone, review the suggested text and save your edits before copying the reply. Generating a new version spends one reply credit.'),
      qa('Can Lead To Client write freelance pitches in my voice?',
        'Add portfolio information and examples of your own writing in Settings. You can also opt in to using your recent edited replies as examples. Review the draft for accuracy and change anything you would phrase differently before responding.'),
      qa('How should I reply to a public request for help?',
        'Read the community’s rules and the buyer’s preferred contact method. Answer the specific question, explain any commercial interest and ask a short question about the scope. Move to a private conversation when the buyer invites it.'),
    ],
  },
  {
    id: 'proposals-and-pipeline',
    title: 'Proposals, follow-ups and won revenue',
    items: [
      qa('How do I turn a freelance lead into a proposal PDF?',
        'Open Proposal on the lead, add your branding and describe the scope. You can offer up to three packages with their own price and timeline. Select Download PDF to send the file yourself, or publish a share link that lets the buyer view the proposal online and download a copy.'),
      qa('Can clients open a proposal without creating an account?',
        'Yes. Anyone with the published proposal link can read it and download its PDF. Send the link directly to the intended recipient. You can revoke the share link in the workspace if you want to end public access.'),
      qa('Can I see when a prospect opens my proposal?',
        'The proposal workspace records the first and last visits to its shared page. Anyone who has the link can open it, so a visit alone cannot identify a particular person. Use the visit times alongside the conversation when planning a follow-up.'),
      qa('How do I track freelance applications and follow-ups?',
        'Mark a job as applied, then open the saved lead and set a follow-up date. The dashboard lists due follow-ups. Move the lead through Replied, Call booked, Proposal sent and Won or Lost as the conversation progresses.'),
      qa('How does Lead To Client calculate revenue won?',
        'Enter each deal value in US dollars and mark the lead Won. Results adds up the current values of won deals and lets you compare outcomes by source or service search. Your team’s stage updates also supply the reply and call counts.'),
    ],
  },
  {
    id: 'alerts-and-agencies',
    title: 'Telegram job alerts and agency workflows',
    items: [
      qa('How do Telegram alerts work for high-intent leads?',
        'Connect your Telegram account in Settings and set a minimum intent score for priority alerts. An automation rule can also send a matching new lead to the connected chat. Where the source provides an availability check, Lead To Client checks the post before delivering a priority alert.'),
      qa('Can I search freelance jobs or watch a skill in Telegram?',
        'Connect your workspace to the Telegram bot. Send /jobs for recent openings or /search shopify to filter them. Send /watch shopify for new matching job alerts, /watch for all openings or /unwatch to stop these alerts. You can keep using /search after you stop alerts.'),
      qa('Can I receive a daily email digest?',
        'Enable the daily lead digest in your workspace settings. The email summarizes recent leads and links back to the workspace so you can review the original posts and choose which ones to pursue.'),
      qa('How does a freelance agency share its lead inbox?',
        'Invite teammates from Settings. In the shared workspace, assign each lead to the person handling it and set a follow-up date. A teammate can open Assigned to me from the dashboard to see the conversations they own.'),
      qa('Can I automatically assign leads and prepare replies for my team?',
        'Create a rule in Automations using a service search, platform, intent threshold or budget evidence. Choose whether the rule assigns a teammate, prepares a reply for review or alerts the connected Telegram chat. Preparing an automatic reply uses one credit.'),
      qa('Can I schedule a follow-up after someone opens a proposal?',
        'Enable proposal follow-up in Automations and choose the delay. The first visit can trigger an email to you and a follow-up draft for your review. Booking a call, closing the deal or revoking the proposal link stops the sequence.'),
    ],
  },
  {
    id: 'pricing-and-credits',
    title: 'Lifetime access and credit usage',
    items: [
      creditCost,
      payingClients,
      lifetimeOffer,
      carryOver,
      creditPacks,
      qa('Can I cap scoring costs and save credits for replies?',
        'Set a credit cap before a manual scan. Under Scans you can also set a monthly scoring limit for a saved service and reserve credits for replies. When a scan reaches its cap, matched leads remain in the inbox and additional automatic reply drafts are skipped.'),
      qa('Why does a scored lead sometimes use zero credits?',
        'When AI scoring is unavailable, a scan can use local rules to assess the wording of a post. The lead identifies this method, and the scan receipt lists the local assessments separately. A local assessment uses zero scoring credits.'),
    ],
  },
]

export const homeFaq = [reddit, publishing, creditCost]
export const howItWorksFaq = [intentScore, publishing]
export const pricingFaq = [creditCost, payingClients, lifetimeOffer, carryOver, creditPacks]
export const marketingFaq = faqGroups.flatMap(group => group.items)
