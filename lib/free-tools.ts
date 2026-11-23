export const toolPages = {
  'reddit-lead-finder': {
    title: 'Free Reddit lead finder for freelancers',
    description:
      'Search public Reddit requests for your freelance skill and review up to three source links without signing in.',
    quick:
      'Enter a skill or a problem you solve to find up to three public Reddit requests. Open the original thread, check its age and read the community rules before replying. A clear request for a deliverable, estimate or recommendation gives you a stronger reason to offer help.',
    question: 'How do I recognize a useful Reddit lead?',
    answer:
      'Look for a buyer who describes what needs changing and gives a constraint such as a deadline, platform or budget. Read the replies to see whether the original request is still open.',
    faq: [
      {
        question: 'How many results appear?',
        answer:
          'The free finder returns up to three matching threads. A narrow query or limited indexing can produce fewer results.',
      },
      {
        question: 'Where does Reddit search data come from?',
        answer:
          'Live search uses indexed public pages through the configured search provider. The preview includes a dated sample that links to the original Reddit posts.',
      },
    ],
  },
  'proposal-generator': {
    title: 'Free freelance proposal generator',
    description:
      'Turn a public project brief into an editable proposal with a first step, deliverable and acceptance check.',
    quick:
      'Paste the request, name a deliverable you can provide and describe how the buyer will check the result. The proposal generator turns those details into a short draft you can edit. Confirm the scope and dependencies before adding a fixed price, delivery date or claim about previous work.',
    question: 'What should a proposal include after a forum request?',
    answer:
      'Reflect the buyer’s actual problem and propose a small first milestone. Include a concrete acceptance check, identify what you need from them and ask one question that will clarify the estimate.',
    faq: [
      {
        question: 'Can I edit the generated proposal?',
        answer:
          'Yes. Change the text in the result box, then use Copy draft to move it into your own editor.',
      },
      {
        question: 'Does the generator quote a price?',
        answer:
          'The draft asks about scope. Add a price after you know what access, deliverables and review rounds the work requires.',
      },
    ],
  },
  'client-pitch-writer': {
    title: 'Free client pitch writer for freelancers',
    description:
      'Write a personal first reply to a freelance request with a helpful next step and a clear invitation to continue.',
    quick:
      'Use a specific detail from the public request, offer one helpful next step and ask permission to discuss a small piece of work. This pitch writer combines your inputs into an editable reply. Check every claim and respect the requester’s preferred channel before deciding whether to send it.',
    question: 'How can I pitch without overwhelming the requester?',
    answer:
      'Offer one step they can try and connect your service to a named part of the problem. Close with a single question and give the requester room to decline.',
    faq: [
      {
        question: 'How long should a first pitch be?',
        answer:
          'A few short sentences usually give you enough room to acknowledge the problem, offer a useful detail and ask a question.',
      },
      {
        question: 'Where does the pitch get posted?',
        answer:
          'You choose whether to copy the finished draft. A person reviews and publishes every reply.',
      },
    ],
  },
} as const
export type ToolName = keyof typeof toolPages
export const redditSnapshot = [
  {
    title: 'Shopify page layout and graphics for two existing pages',
    body: 'The buyer describes two pages, a fixed budget and a short design update.',
    posted_at: '2026-11-17',
    url: 'https://www.reddit.com/r/shopifyDev/comments/1xyed5m/looking_for_a_shopify_developer_for_minor_website/',
    source: 'reddit',
  },
  {
    title: 'Pre-launch Shopify design, SEO and mobile improvements',
    body: 'A merchant asks for a phased implementation quote on an unpublished Clarity theme.',
    posted_at: '2026-11-06',
    url: 'https://www.reddit.com/r/ShopifyAppDev/comments/1xpnnsm/hiring_shopify_designer_needed_for_prelaunch/',
    source: 'reddit',
  },
  {
    title: 'Custom Shopify storefront designers and developers',
    body: 'An ecommerce team requests relevant store examples, availability and pricing for theme development.',
    posted_at: '2026-08-09',
    url: 'https://www.reddit.com/r/GraphicDesignServices/comments/1vjf8j4/hiring/',
    source: 'reddit',
  },
]
