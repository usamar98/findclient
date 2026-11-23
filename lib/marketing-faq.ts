const entries = [
  [
    'How does Clientfind find freelance leads?',
    'A niche combines your skill, keywords, exclusions and selected sources. Scheduled searches bring back recent public posts for intent scoring.',
  ],
  [
    'Who is Clientfind designed for?',
    'Freelancers and small agencies can use it to find people describing problems they can solve. Shopify development and design are starting points.',
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
    'Does Clientfind include Hacker News?',
    'Yes. Hacker News search can surface founder requests and technical questions. Check whether the thread invites commercial responses.',
  ],
  [
    'Can I monitor Bluesky or X?',
    'Bluesky uses public search. X discovery depends on posts visible to the configured web search provider.',
  ],
  [
    'How recent are leads?',
    'The lead engine considers posts from the preceding seven days. Check the original discussion for new replies and closed requests.',
  ],
  [
    'What does an intent score mean?',
    'The score estimates buying intent from zero to one hundred. An author can still decline help or decide to solve the problem independently.',
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
    'Does Clientfind publish replies or send direct messages?',
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
    'The first 10 lifetime deals start at $149 each. The price increases by $10 after every 10 completed deals. The offer ends on December 26, 2026 at 11:59 pm Pakistan time. Your one-time payment includes one niche and a monthly credit refill.',
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
    'Connect Telegram in settings and follow the bot link. Connected accounts can receive notifications for newly discovered leads scoring at least 80.',
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
    'Move relevant leads through saved, replied and won as the conversation develops. Use ignored for threads outside your service.',
  ],
]

export const marketingFaq = entries.map(([question, answer]) => ({
  question,
  answer,
}))
