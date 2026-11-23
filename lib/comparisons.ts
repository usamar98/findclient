export const comparisons = {
  gummysearch: {
    name: 'GummySearch',
    description:
      'Compare GummySearch’s Reddit audience research with Clientfind’s request discovery, intent scoring and editable freelancer replies.',
    quick:
      'GummySearch helped teams study Reddit audiences, recurring problems and conversations across communities. Clientfind focuses on one narrower job: finding public requests a freelancer can solve and drafting a reply for review. GummySearch closed new signups in 2025 and scheduled its final shutdown for December 1, 2026.',
    goal: 'Study Reddit audiences and recurring pain points',
    coverage: 'Reddit communities selected for an audience',
    output: 'Audience research, conversations and saved insights',
    question: 'What should an existing GummySearch user preserve?',
    answer:
      'Export your saved audience definitions and useful research while your account still has access. Separate those records from the buyer-language phrases you want to reuse for finding work.',
    fits: 'Historical research about a market can inform a product decision years later. A freelance lead needs a current request, a plausible scope and a buyer who still wants help. Test your migration with one task from each category.',
    faq: {
      question: 'Can I sign up for GummySearch now?',
      answer:
        'GummySearch closed new signups at the end of November 2025. Its published exit timeline gives eligible existing accounts a transition period through November 30, 2026.',
    },
    url: 'https://gummysearch.com/docs/gummysearch-is-now-closed-6533h',
  },
  f5bot: {
    name: 'F5Bot',
    description:
      'Compare F5Bot keyword alerts with Clientfind’s freelancer inbox, buying-intent explanations and editable replies.',
    quick:
      'F5Bot is a useful choice when you know which terms to monitor on Reddit, Hacker News or Lobsters and want an alert when they appear. Clientfind starts with a freelance skill, scores requests against that niche and keeps the source, draft reply and follow-up status together.',
    goal: 'Track keywords and relevant mentions',
    coverage: 'Reddit, Hacker News and Lobsters',
    output: 'Email alerts, with additional feeds and integrations by plan',
    question: 'Which workflow makes sense for a small agency?',
    answer:
      'Try F5Bot with a distinctive brand name or product keyword that rarely appears by accident. Test Clientfind with a phrase a buyer would use to describe an implementation problem.',
    fits: 'For each test, count how many matches justify a reply and how long a person spends preparing it. F5Bot advertises advanced filters and AI features on its site, so check which plan includes the filtering you need.',
    faq: {
      question: 'Does F5Bot have a free option?',
      answer:
        'Yes. F5Bot offers free keyword alerts and also publishes paid plans with additional filtering and delivery options.',
    },
    url: 'https://f5bot.com/',
  },
  syften: {
    name: 'Syften',
    description:
      'Compare Syften community monitoring with Clientfind’s niche-based discovery, lead status tracking and draft solutions.',
    quick:
      'Syften watches community conversations using configurable filters across channels including Reddit, Hacker News, Slack and Discourse. Clientfind is designed for freelancers who want a queue of relevant public requests, an explanation of buying intent and a first response to edit. Choose according to the channels and outcome you need.',
    goal: 'Monitor community conversations with search filters',
    coverage:
      'Multiple communities including Slack, Discourse, Reddit and Stack Exchange',
    output: 'Matching discussions and alerts for your filters',
    question: 'How should I compare coverage for a particular community?',
    answer:
      'Start with the actual community or channel where your customers post and check its availability in the vendor’s documentation. A platform name alone does not establish access to every space hosted there.',
    fits: 'Run a small test with an uncommon phrase from your market. Track the first useful match, duplicates, irrelevant promotions and the time required to route a request to its owner.',
    faq: {
      question: 'When is Syften worth evaluating?',
      answer:
        'Evaluate Syften when your team needs flexible monitoring across a particular set of communities. Check supported channels, filtering options and alert delivery during its trial.',
    },
    url: 'https://syften.com/',
  },
  octolens: {
    name: 'Octolens',
    description:
      'Compare Octolens social listening and brand monitoring with Clientfind’s freelancer request discovery and reply drafting.',
    quick:
      'Octolens helps teams monitor mentions of their brand, products and competitors across social channels, communities, media and reviews. Clientfind serves a freelancer looking for someone with a specific problem to solve. Compare the tools using a real brand-monitoring task and a separate freelance opportunity search.',
    goal: 'Track brand, competitor and customer conversations',
    coverage: 'Social networks, news, reviews and developer communities',
    output: 'AI-filtered mentions and integrations for teams and agents',
    question: 'Which product fits a brand or competitor research brief?',
    answer:
      'Octolens documents brand monitoring, competitor research and feedback collection as core use cases. For those tasks, define the brands, channels and handoff your team needs before testing the trial.',
    fits: 'A freelancer can evaluate Clientfind by selecting one service, reviewing the source posts and checking whether each suggested solution is relevant. Useful numbers are time to a qualified conversation and time spent editing a draft.',
    faq: {
      question: 'Can both products help with public conversations?',
      answer:
        'Yes. Octolens organizes mentions around topics and brands. Clientfind organizes requests around a freelancer’s skill, score threshold and lead status.',
    },
    url: 'https://octolens.com/',
  },
} as const
