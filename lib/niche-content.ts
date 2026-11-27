export interface NicheContent {
  slug: string
  title: string
  description: string
  quickAnswer: string
  skill: string
  searchPhrases: string[]
  where: string[]
  examples: string[]
  approach: string
  faq: { question: string; answer: string }[]
  related: string[]
}

export const niches: NicheContent[] = [
  {
    slug: 'shopify-developers',
    title: 'Find Shopify development clients for theme and app fixes',
    description:
      'Find theme repair, migration, and product template briefs from merchants who can describe a reproducible Shopify problem.',
    quickAnswer:
      'Search for merchants describing a reproducible problem with a theme, app integration, or product template. Ask what changed, which products are affected, and whether the issue also appears in a preview theme. When the owner invites paid help, offer a scoped diagnostic with a test the merchant can repeat.',
    skill: 'Shopify developer',
    searchPhrases: ['Shopify theme fix', 'hire a Liquid developer', 'custom product template'],
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
      {
        question: 'What signals that a Shopify merchant wants to hire a developer?',
        answer:
          'Look for a merchant who names an affected template, shares the steps that trigger the issue and asks for a quote or a delivery date. Someone asking how Liquid works may only want an explanation. Check the original request for an invitation to take on the work.',
      },
      {
        question: 'What can I put in a proposal for a Shopify app integration?',
        answer:
          'Name the app, the store action it should handle and the result the merchant should see. For example, agree which subscription option should reach the cart when a shopper changes variants. Use that test to define when the integration is complete.',
      },
    ],
    related: ['shopify-designers', 'wordpress-developers'],
  },
  {
    slug: 'shopify-designers',
    title: 'How to find Shopify design clients for storefront redesigns',
    description:
      'Find storefront design briefs about collection navigation, product layouts, sizing information, and mobile shopping tasks.',
    quickAnswer:
      'Look for store owners who can name a product detail their customers struggle to find, such as sizing, delivery dates, or subscription options. Review the affected page at the width they describe. Suggest a specific layout change and agree on what a shopper should be able to do afterward.',
    skill: 'Shopify designer',
    searchPhrases: ['redesign our Shopify store', 'mobile product page redesign', 'Shopify collection layout'],
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
      {
        question: 'Which storefront requests make a good first Shopify design project?',
        answer:
          'A collection page with confusing filters or a product page with hard-to-find size information gives a designer one buyer decision to improve. Ask for the page, the intended shopper and the device where the problem occurs before proposing a mockup.',
      },
      {
        question: 'How should I quote a Shopify redesign when many products share a layout?',
        answer:
          'Count the distinct templates the merchant needs. Two hundred products can share one template, while bundles, subscriptions and made-to-order items may each need their own layout. Ask the merchant to supply a representative product for each type.',
      },
    ],
    related: ['shopify-developers', 'ui-ux-designers'],
  },
  {
    slug: 'web-designers',
    title: 'Find web design clients for landing pages and redesigns',
    description:
      'Identify requests for service pages, campaign sites, and local business redesigns. Qualify content readiness before quoting.',
    quickAnswer:
      'Search for business owners explaining what a visitor needs to do on a new or redesigned website. A brief about booking appointments, comparing service packages, or finding a location gives you a concrete design task. Ask who supplies content and who approves the first layout before estimating the project.',
    skill: 'Web designer',
    searchPhrases: ['need a booking website', 'redesign our landing page', 'looking for a website designer'],
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
      {
        question: 'How do I qualify a web design lead from a local business?',
        answer:
          'Ask how customers currently book, request a quote or find the business. A business opening a new location may need a location page, directions and a booking form. The owner’s answer tells you what to include and who will maintain it.',
      },
      {
        question: 'What should a freelance landing page proposal include?',
        answer:
          'Identify the offer, the audience, the action visitors should take and who supplies the copy and images. List the layouts and form connections in the quote. If the campaign has a launch date, agree on a deadline for receiving the content.',
      },
    ],
    related: ['webflow-developers', 'copywriters'],
  },
  {
    slug: 'seo-freelancers',
    title: 'Find freelance SEO clients for audits and site migrations',
    description:
      'Qualify migration, indexing, and content audit requests using page groups, search markets, and a timeline of measurable changes.',
    quickAnswer:
      'Look for owners describing a specific search visibility change after a migration, redesign, or catalog update. Ask which page group changed and when the change began. Offer a bounded investigation with a deliverable the owner can check, such as a redirect sample or a prioritized list of indexing discrepancies.',
    skill: 'SEO freelancer',
    searchPhrases: ['traffic dropped after migration', 'need a technical SEO audit', 'help with redirect mapping'],
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
      {
        question: 'Which requests could become a paid technical SEO audit?',
        answer:
          'Look for an owner asking someone to investigate a dated change, such as product pages disappearing after a migration, with an agreed deliverable. A request for an estimate, a list of affected URLs or a launch deadline gives you a starting point for scoping the audit.',
      },
      {
        question: 'How can I scope a small SEO migration project?',
        answer:
          'Agree on the URL groups moving, the person who implements redirects and the date you can check the new site. Offer a sample mapping before launch and a post-launch check of representative URLs. State how you will report issues and who will fix them.',
      },
    ],
    related: ['wordpress-developers', 'marketing-agencies'],
  },
  {
    slug: 'video-editors',
    title: 'Find freelance video editing clients for YouTube and podcasts',
    description:
      'Find funded video briefs and scope raw footage, captions, deliverable formats, approval rounds, and deadlines before quoting.',
    quickAnswer:
      'Search for creators who describe both the footage they have and the finished piece they need. Confirm the source runtime, number of cameras, intended platform, and review deadline. A quote for one pilot edit gives the client a chance to approve pacing, audio treatment, and captions before commissioning a series.',
    skill: 'Video editor',
    searchPhrases: ['hiring a YouTube editor', 'podcast clips editor', 'edit our course videos'],
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
      {
        question: 'How do I tell if a video editing request offers paid work?',
        answer:
          'Read the original brief for a fee, a request for your rate or an invitation to quote. Confirm sourcing rights, who supplies the footage and how the pilot will be paid. Revenue sharing, channel credit and promises of future work describe different terms from a paid edit.',
      },
      {
        question: 'How can I quote recurring short-form edits for a podcast?',
        answer:
          'Ask how many episodes arrive each month, the typical raw runtime and whether the producer chooses the clips. Set a price for an agreed number of finished clips, aspect ratios and revision rounds. Use one paid pilot to check the editing time.',
      },
    ],
    related: ['copywriters', 'marketing-agencies'],
  },
  {
    slug: 'copywriters',
    title: 'Find copywriting clients for landing pages and email campaigns',
    description:
      'Review landing page, email sequence, and product copy briefs. Qualify the reader, message, evidence, and approval process.',
    quickAnswer:
      'Look for buyers who know the reader, the offer, and the decision their copy should support. A request to explain a pricing change to existing customers is easier to scope than a general request for better writing. Ask what evidence supports the message and who has final approval.',
    skill: 'Copywriter',
    searchPhrases: ['hire a landing page copywriter', 'rewrite our pricing page', 'write our welcome emails'],
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
      {
        question: 'Where can I spot a copywriting project in a founder conversation?',
        answer:
          'Look for a founder about to launch an offer who can name the audience and the page or emails they need written. A request for a quote or for a writer with relevant samples indicates hiring intent. A request for general feedback may be a peer discussion.',
      },
      {
        question: 'What should I clarify before pricing an email sequence?',
        answer:
          'Confirm the number of emails, the trigger for the first send, the existing offer and who signs off on the claims. Ask whether the client expects you to write the copy, build it in their email tool or do both. Those are different amounts of work.',
      },
    ],
    related: ['web-designers', 'marketing-agencies'],
  },
  {
    slug: 'wordpress-developers',
    title: 'Find WordPress clients for maintenance, repairs and migrations',
    description:
      'Identify plugin conflicts, template changes, and migration briefs. Scope a staging test and a handover the owner can verify.',
    quickAnswer:
      'Search for site owners who can identify the page, plugin, or publishing workflow that changed after an update. Ask whether the issue reproduces on staging and which versions were involved. Quote a limited investigation first when the outcome depends on an unknown interaction between the theme, plugins, and hosting environment.',
    skill: 'WordPress developer',
    searchPhrases: ['WordPress migration help', 'hire a WooCommerce developer', 'WordPress maintenance retainer'],
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
      {
        question: 'Where should I look for paid WordPress work versus support questions?',
        answer:
          'Search buyer-written hiring briefs for a specific fix, migration or monthly maintenance need. WordPress support threads can teach you how owners describe a problem. Use the contact or application method a buyer provides in a hiring post, and respect each forum’s rules.',
      },
      {
        question: 'What should I ask before quoting a WooCommerce repair?',
        answer:
          'Ask which checkout step fails, which payment or shipping method is involved and whether the owner can reproduce the issue on staging. Agree on a test order and the expected result before estimating a fix.',
      },
    ],
    related: ['seo-freelancers', 'shopify-developers'],
  },
  {
    slug: 'webflow-developers',
    title: 'How to find Webflow clients for CMS builds and site migrations',
    description:
      'Find CMS structure, responsive layout, and migration requests. Use real editorial tasks to scope Webflow work.',
    quickAnswer:
      'Look for teams whose published site works until an editor adds another case study, event, or team member. Ask what content changes regularly and which layouts must support it. Propose one CMS collection or reusable component with a test showing the editor can publish a new item independently.',
    skill: 'Webflow developer',
    searchPhrases: ['migrate our site to Webflow', 'Webflow CMS developer', 'build our Webflow landing pages'],
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
      {
        question: 'How can I qualify a Webflow migration lead?',
        answer:
          'Ask which platform the team is leaving, how many collections and content items need to move and which old URLs must keep working. A buyer with an export, a launch date and a person responsible for publishing can help you scope a first migration milestone.',
      },
      {
        question: 'What belongs in a Webflow development quote for an agency?',
        answer:
          'Establish whether the agency supplies approved designs and who handles CMS imports, interactions, redirects and client training. Name the pages, reusable components and review rounds. Agree whether you will work with the client directly or through the agency’s project manager.',
      },
    ],
    related: ['web-designers', 'ui-ux-designers'],
  },
  {
    slug: 'ui-ux-designers',
    title: 'Find freelance UI and UX design projects for SaaS products',
    description:
      'Identify product design briefs about onboarding, unclear interfaces, and evidence of repeated friction. Scope one user task.',
    quickAnswer:
      "Find teams describing the point where a user abandons a task, asks support for help, or repeats a step unnecessarily. Ask to see the current workflow and the user's goal. Propose a focused prototype or research session with an observable success condition before estimating an entire application redesign.",
    skill: 'UI/UX designer',
    searchPhrases: ['redesign our onboarding', 'SaaS UX audit', 'hire a product designer'],
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
      {
        question: 'How can I turn an onboarding complaint into a scoped UX project?',
        answer:
          'Ask which user is trying to complete which task and where the flow breaks down. If the team wants to hire, propose reviewing one flow, documenting the friction and testing a revised prototype. Agree on how the team will decide whether the change helped.',
      },
      {
        question: 'What portfolio example should I send for a UI or UX brief?',
        answer:
          'Show a comparable user task and the decision your work helped the team make. For a permissions redesign, show how an admin chose the right role and how you tested that choice. A short flow with a clear outcome helps the buyer assess fit.',
      },
    ],
    related: ['webflow-developers', 'shopify-designers'],
  },
  {
    slug: 'marketing-agencies',
    title: 'Find marketing agency clients for campaigns and retainers',
    description:
      'Assess campaign briefs by audience, approval authority, assets, media spend, and reporting requirements.',
    quickAnswer:
      'Search for businesses describing a campaign deadline, an existing audience, and a measurable action they want customers to take. Ask who owns the channel, what assets are available, and how outcomes will be reviewed. Offer a single-channel pilot with a clear reporting period and an agreed decision at the end.',
    skill: 'Marketing agency',
    searchPhrases: ['looking for a paid media agency', 'need a campaign launch partner', 'email marketing retainer'],
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
      {
        question: 'How can an agency tell whether a buyer wants ongoing marketing support?',
        answer:
          'Look for a recurring campaign calendar, a regular reporting need and a named person who can approve spend. Ask which work the internal team already handles. A recurring task with an owner and a budget gives you a basis for discussing a retainer.',
      },
      {
        question: 'How should a small agency handle a promising lead in a shared inbox?',
        answer:
          'Assign one teammate to own the conversation and record the buyer’s decision date. That person can send the brief to a specialist, share a proposal link and set a follow-up date. One named contact keeps the buyer from receiving duplicate pitches.',
      },
    ],
    related: ['seo-freelancers', 'video-editors'],
  },
]
