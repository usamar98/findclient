import { coverageIntro, freshnessAnswer } from './marketing-coverage'

const entries = [
  [
    'How does Lead To Client find freelance leads?',
    'Choose the service you sell, the phrases a buyer might use, and the communities you want to monitor. Lead To Client scores matching public posts, saves qualifying requests in your inbox and links each one to the original conversation.',
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
    'A web search provider discovers indexed Reddit discussions. Coverage depends on the provider and the public pages it can find.',
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
    'Bluesky uses public search. X discovery depends on posts visible to the configured web search provider.',
  ],
  [
    'How recent are leads?',
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
    'Scoring one public request uses one credit. Generating or regenerating a reply also uses one credit. You can see your remaining balance in workspace settings.',
  ],
  [
    'Is a credit a guaranteed client?',
    'Credits pay for processing. A paid engagement depends on the request, the buyer and the quality of your response.',
  ],
  [
    'How does the lifetime deal work?',
    'The first 10 lifetime deals start at $149 each. The price increases by $10 after every 10 completed deals. The offer ends on December 26, 2026 at 11:59 pm Pakistan time. Lifetime access includes three service searches and a shared monthly credit refill.',
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
  ['How often does Lead To Client check for new leads?', coverageIntro],
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
    'The workspace shows leads collected by scheduled searches. The public Reddit lead finder can run a search on demand and can reuse results for the same query for up to one hour. Its results depend on which public Reddit posts the provider has indexed.',
  ],
]

export const marketingFaq = entries.map(([question, answer]) => ({
  question,
  answer,
}))
