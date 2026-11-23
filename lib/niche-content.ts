export interface NicheContent {
  slug: string
  title: string
  description: string
  quickAnswer: string
  skill: string
  where: string[]
  examples: string[]
  approach: string
  faq: { question: string; answer: string }[]
  related: string[]
}

export const niches: NicheContent[] = [
  {
    slug: 'shopify-developers',
    title: 'Find Shopify developer clients on Reddit and forums',
    description:
      'Find theme repair, migration, and product template briefs from merchants who can describe a reproducible Shopify problem.',
    quickAnswer:
      'Search for merchants describing a reproducible problem with a theme, app integration, or product template. Ask what changed, which products are affected, and whether the issue also appears in a preview theme. When the owner invites paid help, offer a scoped diagnostic with a test the merchant can repeat.',
    skill: 'Shopify developer',
    where: [
      'Shopify Community theme discussions',
      'r/forhire Shopify development briefs',
    ],
    examples: [
      'A variant switch displays the wrong product image.',
      'A merchant needs to migrate a custom size guide before a theme update.',
    ],
    approach:
      'Track symptom phrases like “wrong variant image.” Suggest a preview test on one affected product and explain what each possible result means.',
    faq: [
      {
        question: 'What do I need before quoting a theme fix?',
        answer:
          'Ask for the theme version, affected template, and expected behaviour. Quote an investigation first if the cause could be in an app or theme code.',
      },
    ],
    related: ['shopify-designers', 'wordpress-developers'],
  },
  {
    slug: 'shopify-designers',
    title: 'Find Shopify design clients on Reddit and forums',
    description:
      'Find storefront design briefs about collection navigation, product layouts, sizing information, and mobile shopping tasks.',
    quickAnswer:
      'Look for store owners who can name a product detail their customers struggle to find, such as sizing, delivery dates, or subscription options. Review the affected page at the width they describe. Suggest a specific layout change and agree on what a shopper should be able to do afterward.',
    skill: 'Shopify designer',
    where: [
      'Shopify Community storefront design discussions',
      'r/DesignJobs ecommerce design briefs',
    ],
    examples: [
      'A clothing merchant wants fit guidance beside the size selector.',
      'A wholesale store needs to distinguish case quantities from individual units.',
    ],
    approach:
      'Group requests by shopping task. Include a relevant portfolio detail and one preview layout before estimating a store-wide redesign.',
    faq: [
      {
        question: 'How do I define design approval?',
        answer:
          'Agree on the shopper task, target viewport, and required product information. Ask the merchant to review a preview against those criteria.',
      },
    ],
    related: ['shopify-developers', 'ui-ux-designers'],
  },
  {
    slug: 'web-designers',
    title: 'Find web design clients on Reddit and forums',
    description:
      'Identify requests for service pages, campaign sites, and local business redesigns. Qualify content readiness before quoting.',
    quickAnswer:
      'Search for business owners explaining what a visitor needs to do on a new or redesigned website. A brief about booking appointments, comparing service packages, or finding a location gives you a concrete design task. Ask who supplies content and who approves the first layout before estimating the project.',
    skill: 'Web designer',
    where: [
      'r/DesignJobs project briefs',
      'Indie Hackers launch and landing page discussions',
    ],
    examples: [
      'A clinic needs a page that explains appointment types before booking.',
      'A local studio wants an event page the owner can update between workshops.',
    ],
    approach:
      'Use milestone phrases like “opening a second location.” Build a reply around the visitor task, content owner, and first mobile layout.',
    faq: [
      {
        question: 'How can I tell whether a redesign brief is ready?',
        answer:
          'Look for an audience, a page owner, and a decision the visitor needs to make. Confirm who can approve a layout before reserving time.',
      },
    ],
    related: ['webflow-developers', 'copywriters'],
  },
  {
    slug: 'seo-freelancers',
    title: 'Find freelance SEO clients on Reddit and forums',
    description:
      'Qualify migration, indexing, and content audit requests using page groups, search markets, and a timeline of measurable changes.',
    quickAnswer:
      'Look for owners describing a specific search visibility change after a migration, redesign, or catalog update. Ask which page group changed and when the change began. Offer a bounded investigation with a deliverable the owner can check, such as a redirect sample or a prioritized list of indexing discrepancies.',
    skill: 'SEO freelancer',
    where: [
      'r/TechSEO migration and indexing discussions',
      'r/forhire technical audit requests',
    ],
    examples: [
      'A publisher wants legacy URLs checked after a restructure.',
      'A retailer wants canonical signals reviewed across regional storefronts.',
    ],
    approach:
      'Record affected templates and dates. Explain which data inputs you need and which business decision your audit will support.',
    faq: [
      {
        question: 'What should I request after a traffic decline?',
        answer:
          'Ask for affected dates, pages, markets, and a site-change timeline. Accept aggregate data and let the owner redact sensitive information.',
      },
    ],
    related: ['wordpress-developers', 'marketing-agencies'],
  },
  {
    slug: 'video-editors',
    title: 'Find video editing clients on Reddit and forums',
    description:
      'Find funded video briefs and scope raw footage, captions, deliverable formats, approval rounds, and deadlines before quoting.',
    quickAnswer:
      'Search for creators who describe both the footage they have and the finished piece they need. Confirm the source runtime, number of cameras, intended platform, and review deadline. A quote for one pilot edit gives the client a chance to approve pacing, audio treatment, and captions before commissioning a series.',
    skill: 'Video editor',
    where: [
      'r/CreatorServices production requests',
      'r/VideoEditingRequests and r/YouTubeEditorsForHire briefs',
    ],
    examples: [
      'A teacher needs captions and consistent audio across recorded lessons.',
      'A podcast producer wants three vertical clips from a two-camera interview.',
    ],
    approach:
      'Distinguish selecting moments from editing an existing shortlist. Include one portfolio timestamp demonstrating a comparable cut.',
    faq: [
      {
        question: 'Why can a short edit take several days?',
        answer:
          'Review raw footage length, number of versions, caption accuracy, and whether the buyer has chosen the moments. Final runtime alone leaves these costs unclear.',
      },
    ],
    related: ['copywriters', 'marketing-agencies'],
  },
  {
    slug: 'copywriters',
    title: 'Find copywriting clients on Reddit and forums',
    description:
      'Review landing page, email sequence, and product copy briefs. Qualify the reader, message, evidence, and approval process.',
    quickAnswer:
      'Look for buyers who know the reader, the offer, and the decision their copy should support. A request to explain a pricing change to existing customers is easier to scope than a general request for better writing. Ask what evidence supports the message and who has final approval.',
    skill: 'Copywriter',
    where: [
      'r/HireAWriter paid writing requests',
      'Indie Hackers positioning and launch discussions',
    ],
    examples: [
      'A software team needs an email explaining a pricing change.',
      'A maker needs descriptions that help shoppers choose between materials.',
    ],
    approach:
      'Follow phrases such as “rewrite our pricing page.” Replace general performance promises in a draft with one concrete editorial decision.',
    faq: [
      {
        question: 'Which writing sample should accompany my proposal?',
        answer:
          'Select a sample that helped a similar reader make a comparable decision. Explain the original brief and your contribution in one sentence.',
      },
    ],
    related: ['web-designers', 'marketing-agencies'],
  },
  {
    slug: 'wordpress-developers',
    title: 'Find WordPress developer clients on Reddit and forums',
    description:
      'Identify plugin conflicts, template changes, and migration briefs. Scope a staging test and a handover the owner can verify.',
    quickAnswer:
      'Search for site owners who can identify the page, plugin, or publishing workflow that changed after an update. Ask whether the issue reproduces on staging and which versions were involved. Quote a limited investigation first when the outcome depends on an unknown interaction between the theme, plugins, and hosting environment.',
    skill: 'WordPress developer',
    where: [
      'WordPress.org public plugin support forums',
      'r/forhire WordPress maintenance requests',
    ],
    examples: [
      'A block plugin update changed an article layout.',
      'A membership site needs to preserve existing URLs during a theme migration.',
    ],
    approach:
      'Record the symptoms and versions. Offer one staging check before proposing code changes and agree who will approve publication.',
    faq: [
      {
        question: 'What belongs in a WordPress maintenance handover?',
        answer:
          'List affected versions, changes, verification steps, and a rollback procedure. Explain what the owner should check after the next update.',
      },
    ],
    related: ['seo-freelancers', 'shopify-developers'],
  },
  {
    slug: 'webflow-developers',
    title: 'Find Webflow developer clients on Reddit and forums',
    description:
      'Find CMS structure, responsive layout, and migration requests. Use real editorial tasks to scope Webflow work.',
    quickAnswer:
      'Look for teams whose published site works until an editor adds another case study, event, or team member. Ask what content changes regularly and which layouts must support it. Propose one CMS collection or reusable component with a test showing the editor can publish a new item independently.',
    skill: 'Webflow developer',
    where: [
      'Webflow Community forum CMS discussions',
      'r/webflow editing and publishing questions',
    ],
    examples: [
      'A portfolio collection needs to handle portrait and landscape images.',
      'An event template should carry a reusable registration block.',
    ],
    approach:
      'Search for the editing task alongside “CMS template.” Define which fields the editor maintains and test long headings and varied image dimensions.',
    faq: [
      {
        question: 'How can a client check a Webflow CMS handover?',
        answer:
          'Ask an editor to add an item, change its image, and preview it at the agreed breakpoints. Check both the listing and the detail page.',
      },
    ],
    related: ['web-designers', 'ui-ux-designers'],
  },
  {
    slug: 'ui-ux-designers',
    title: 'Find UI and UX design clients on Reddit and forums',
    description:
      'Identify product design briefs about onboarding, unclear interfaces, and evidence of repeated friction. Scope one user task.',
    quickAnswer:
      "Find teams describing the point where a user abandons a task, asks support for help, or repeats a step unnecessarily. Ask to see the current workflow and the user's goal. Propose a focused prototype or research session with an observable success condition before estimating an entire application redesign.",
    skill: 'UI/UX designer',
    where: [
      'Indie Hackers early customer feedback discussions',
      'r/DesignJobs interface design and prototype briefs',
    ],
    examples: [
      'Admins invite teammates but cannot find permissions.',
      'Returning customers must re-enter details during booking.',
    ],
    approach:
      'Look for evidence of friction in one task. Define what a participant should accomplish independently and test that before recommending a redesign.',
    faq: [
      {
        question: 'How can I qualify a UX research brief?',
        answer:
          'Ask which decision the team needs to make and which group experiences the issue. Check whether participants or existing research are available.',
      },
    ],
    related: ['webflow-developers', 'shopify-designers'],
  },
  {
    slug: 'marketing-agencies',
    title: 'Find marketing agency clients on Reddit and forums',
    description:
      'Assess campaign briefs by audience, approval authority, assets, media spend, and reporting requirements.',
    quickAnswer:
      'Search for businesses describing a campaign deadline, an existing audience, and a measurable action they want customers to take. Ask who owns the channel, what assets are available, and how outcomes will be reviewed. Offer a single-channel pilot with a clear reporting period and an agreed decision at the end.',
    skill: 'Marketing agency',
    where: [
      'Indie Hackers founder-led launch discussions',
      'r/forhire professional marketing briefs that accept agency applications',
    ],
    examples: [
      'A software team wants a webinar campaign for its opt-in audience.',
      'A retailer needs seasonal campaign landing pages and creative variations.',
    ],
    approach:
      'Separate service fees from media spend. Name one channel, one audience, and one conversion event before building the pitch.',
    faq: [
      {
        question: 'Which budget details should an agency clarify?',
        answer:
          'Confirm the split between media, production, and management. Ask whether the buyer has approved those amounts for the full test period.',
      },
    ],
    related: ['seo-freelancers', 'video-editors'],
  },
]
