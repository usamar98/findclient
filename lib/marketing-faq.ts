import { coverageIntro, freshnessAnswer } from './marketing-coverage'
import { lifetimeLastDay } from './offers'
import { platformFreshnessAnswer, platformGuideRows, platformTimingNote, platformWatchAnswer } from './platform-guide'

const entries = [
  [
    'How does Lead To Client find freelance leads?',
    'Use Live Research for an immediate search across community posts and paid freelance openings. For ongoing discovery, save the service you sell, the phrases a buyer might use and the communities to monitor. Lead To Client scores matching posts and saves qualifying requests in your inbox with a link to the original conversation.',
  ],
  [
    'Who is Lead To Client designed for?',
    'Lead To Client is for freelancers and small agencies selling a defined service. A Shopify developer might look for a merchant requesting a theme fix, while a design studio might look for a founder seeking a landing-page quote.',
  ],
  [
    'What makes a post a promising lead?',
    'Look for a concrete problem, a request for implementation and a timing or budget cue. Read the original thread before offering help.',
  ],
  [
    'Where do Reddit results come from?',
    'Live Research uses Reddit search when the app has approved Reddit API access. Otherwise it can use the Exa search index when configured. Saved community scans use Exa for Reddit. The live coverage report shows which method ran and whether it returned posts.',
  ],
  [
    'Can I search Shopify Community?',
    'Choose Shopify as a source when configuring a niche. Look for merchant questions with enough detail for a useful answer.',
  ],
  [
    'Does Lead To Client include Hacker News?',
    'Yes. Hacker News search can surface founder requests and technical questions. Check whether the thread invites commercial responses.',
  ],
  [
    'Can I monitor Bluesky or X?',
    'Bluesky posts are searchable through its public API. Live Research can use X recent search when the app has API access, or the Exa search index when configured. Saved searches on X use the index.',
  ],
  [
    'How recent are the leads in my saved searches?',
    freshnessAnswer,
  ],
  [
    'What does an intent score mean?',
    'The intent score estimates how strongly a public post signals demand for the service you selected, on a scale of 0–100. Your minimum intent score controls which requests enter your inbox. Each saved lead includes the reason and the original thread so you can check the interpretation.',
  ],
  [
    'Can I change the minimum score?',
    'Set the threshold in your niche settings. Raise it when broad searches return too many low-priority requests.',
  ],
  [
    'What should I include in a keyword list?',
    'Use phrases buyers type when stuck, alongside platform and deliverable names. Remove terms that repeatedly match unrelated posts.',
  ],
  [
    'What is a negative keyword?',
    'An exclusion filters out irrelevant conversations. A Shopify specialist might exclude interview preparation and job-seeker introductions.',
  ],
  [
    'Does Lead To Client publish replies or send direct messages?',
    'You control publication. Edit the draft and open the original post to respond yourself if community rules permit.',
  ],
  [
    'What does a generated response contain?',
    'A response includes a proposed solution and a short pitch. Verify technical instructions and replace assumptions with details you can support.',
  ],
  [
    'Can I edit or regenerate a draft?',
    'Yes. Review the suggested response, select a tone and edit the wording before copying. Regeneration spends credits.',
  ],
  [
    'What can I do with a credit?',
    'AI scoring costs one credit per post, including posts below your minimum intent score. Each reply draft or regeneration costs one more. For example, 150 credits can cover 120 AI-scored posts and 30 replies drafted. Searching Live Research uses no scoring credits.',
  ],
  [
    'Is a credit a guaranteed client?',
    'Credits pay for processing. A paid engagement depends on the request, the buyer and the quality of your response.',
  ],
  [
    'How does the lifetime deal work?',
    `The first 10 lifetime deals start at $149 each. The price increases by $10 after every 10 completed deals. The final day to buy is ${lifetimeLastDay}, through 11:59 PM Pakistan time. Lifetime access includes three service searches and a shared monthly credit refill.`,
  ],
  [
    'Do unused credits carry over?',
    'Yes. Your unused credits stay in your workspace when your lifetime allowance refills or you buy a one-time pack.',
  ],
  [
    'Can I purchase more credits?',
    'One-time credit packs appear on the pricing page. Review the selected pack, credit quantity and total in Stripe Checkout before paying.',
  ],
  [
    'How do Telegram alerts work?',
    'Connect Telegram in settings and choose a minimum intent score for priority alerts. Lead To Client checks the qualifying post before delivery where the source provides that information.',
  ],
  [
    'Can I receive a digest instead?',
    'Enable the daily email digest in settings. It summarizes recent leads and links back to your workspace for review.',
  ],
  [
    'How should I approach a community safely?',
    'Read the rules, answer the actual question and disclose a commercial interest where appropriate. Ask permission before continuing privately.',
  ],
  [
    'How do I track results?',
    'Assign the lead to a teammate and set a follow-up date. Record when you reply, book a call or send a proposal. Enter the deal value in US dollars and mark the deal won or lost. The revenue counter sums the values of deals your team marked won.',
  ],
  ['How often do saved community searches check for new leads?', coverageIntro],
  [
    'What does the buyer quality score measure?',
    'Buyer quality is a separate 0–100 score based on evidence of a hiring request, budget, an existing business or website, urgency and account age where available. Open the source to verify the budget and authority to hire before quoting.',
  ],
  [
    'What happens when a lead includes a website?',
    'Lead To Client checks the linked public page for speed, search metadata and mobile layout issues. Completed checks can supply specific observations for a reply. A teammate can also enter a business website on the lead.',
  ],
  [
    'Can I write pitches in my own voice?',
    'Add a portfolio and writing samples in your workspace. You can also opt in to using your own edited replies as examples. Review each generated pitch and decide what to publish.',
  ],
  [
    'Can clients open a proposal without an account?',
    'Yes. Publish a proposal with your branding, packages, prices and timelines, then send its share link. Anyone with that link can read the published version or download the PDF. The workspace shows when the link was first and last opened and lets you revoke it.',
  ],
  [
    'Does refreshing the inbox start a live search?',
    'Refreshing the inbox loads leads your workspace has already saved. To run a saved community search now, open Scans, choose the search and set a credit cap. To look for current posts or browse freelance openings, open Live Research.',
  ],
  [
    'Which platforms can I search without an API key or Exa?',
    'Nine Live Research sources work without a source API key or Exa. They are Hacker News, Bluesky, Stack Overflow, Shopify Community, selected public forums, We Work Remotely, Remote OK, GitHub paid bounties and Mastodon hiring posts. Reddit and X use configured API access or Exa. Indie Hackers uses Exa. The public forums option checks feeds from Bubble, WordPress and Webflow.',
  ],
  [
    'Where can I look for paid freelance work without entering a keyword?',
    'Open Jobs in your workspace to see freelance work published in the past 24 hours. We Work Remotely contracts without published compensation are marked “Pay not listed.” Remote OK shows contract listings with evidence of pay. GitHub results are open, unassigned issues where a maintainer offers a cash bounty. Mastodon results are original paid hiring posts from selected tags visible on mastodon.social. Open the original listing to confirm availability and check the terms.',
  ],
]

export const productFaq = entries.map(([question, answer]) => ({
  question,
  answer,
}))

export const liveResearchTimingFaq = [
  {
    question: 'How does the 15-minute filter find fresh freelance leads?',
    answer: platformFreshnessAnswer,
  },
  {
    question: 'How do I enable the 1-minute recheck in Live Research?',
    answer: platformWatchAnswer,
  },
  {
    question: 'How fresh are freelance leads from each source?',
    answer: [platformTimingNote, ...platformGuideRows.map(row => row.name + '. ' + row.freshness)].join(' '),
    introduction: platformTimingNote,
    sources: platformGuideRows,
  },
]

export const marketingFaq = [...productFaq, ...liveResearchTimingFaq]
