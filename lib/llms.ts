import { absolute } from './seo'
import { infoPages } from './marketing-pages'
import { marketingFaq } from './marketing-faq'
import {
  buyerQualityExample,
  buyerQualityMethod,
  sourceCoverage,
  coverageIntro,
} from './marketing-coverage'
import { staticPageUpdated } from './public-pages'
import { posts } from './posts'
import { niches } from './niche-content'
import { platformGuideRows } from './platform-guide'
import { platformGuideMarkdown } from './platform-guide-markdown'

function link(path: string, label: string, description: string) {
  return `- [${label}](${absolute(path)}): ${description}`
}

export function llmsDocument(full: boolean) {
  const journal = posts()
  const lines = [
    '# Lead To Client',
    '',
    '> ' + infoPages.about.answer,
    '',
    '## Product documentation',
    '',
    link('/', 'Lead To Client', 'Official product website.'),
    link(
      '/platforms',
      'Live Research platforms for freelance leads and paid work',
      platformGuideRows.map((row) => row.name).join(', ') + '.',
    ),
    link(
      '/how-it-works',
      'How Lead To Client works',
      'From a public request to a shared inbox, proposal and recorded deal.',
    ),
    link(
      '/how-it-works#source-coverage',
      'Saved search sources and scan intervals',
      'Which sources feed the lead inbox and when scheduled scans run.',
    ),
    link(
      '/how-it-works#buyer-quality',
      'Buyer quality scoring',
      'What each buying signal contributes to the score, with an example.',
    ),
    link(
      '/pricing',
      'Lifetime pricing and credits',
      'Current offer, credit packs and purchase terms.',
    ),
    link(
      '/faq',
      'Product questions and answers',
      'Buyer scores, reply drafts, alerts, proposal links and revenue tracking.',
    ),
    link('/changelog', 'Release notes', 'Dated product updates.'),
    '',
    '## Freelance research and tools',
    '',
    link(
      '/find-clients',
      'Find clients by service',
      'Community and qualification guides for different freelance services.',
    ),
    link(
      '/blog',
      'The Lead To Client Journal',
      'Worked examples with authors, sources and update dates.',
    ),
    link(
      '/tools/reddit-lead-finder',
      'Reddit lead finder',
      'Search publicly indexed Reddit requests.',
    ),
    link(
      '/tools/proposal-generator',
      'Proposal generator',
      'Turn a project brief into an editable proposal draft.',
    ),
    link(
      '/tools/client-pitch-writer',
      'Client pitch writer',
      'Write a first reply to a buyer.',
    ),
    '',
    '## Publisher and policies',
    '',
    link(
      '/about',
      'About Lead To Client',
      'Product audience and editorial approach.',
    ),
    link(
      '/contact',
      'Contact and corrections',
      'How to report a source or request an editorial correction.',
    ),
    link(
      '/privacy',
      'Privacy',
      'Account data, public sources, proposal opens and writing samples.',
    ),
    link(
      '/terms',
      'Terms of service',
      'Use of the service and purchase terms.',
    ),
    '',
    '## Optional',
    '',
    link(
      '/llms-full.txt',
      'Expanded plain-text guide',
      'Product questions, source coverage, service playbooks and journal articles.',
    ),
    link(
      '/guides/platforms.md',
      'Platform guide in Markdown',
      'Source access, paid-work filters, publication time and search runtime.',
    ),
    link('/rss.xml', 'Journal RSS', 'Published guides in feed format.'),
    ...journal.map((post) =>
      link('/guides/' + post.slug + '.md', post.title, post.description),
    ),
  ]
  if (!full) return lines.join('\n') + '\n'

  lines.push(
    '',
    platformGuideMarkdown('##'),
    '',
    '## Product guide',
    '',
    'Updated ' + staticPageUpdated('/how-it-works') + '.',
    '',
    'Source: ' + absolute('/how-it-works'),
    '',
    infoPages['how-it-works'].answer,
  )
  for (const [question, answer] of infoPages['how-it-works'].sections) {
    lines.push('', '### ' + question, '', answer)
  }
  lines.push('', '### Scheduled scans for saved searches', '', coverageIntro, '')
  for (const row of sourceCoverage) {
    lines.push(`- ${row.sources}: ${row.method} [${row.reference}](${row.url})`)
  }
  lines.push(
    '',
    '### How is buyer quality scored?',
    '',
    buyerQualityMethod,
    '',
    buyerQualityExample,
  )
  lines.push('', '## Product questions', '', 'Source: ' + absolute('/faq'))
  for (const { question, answer } of marketingFaq) {
    lines.push('', '### ' + question, '', answer)
  }
  lines.push('', '## Service playbooks')
  for (const niche of niches) {
    lines.push(
      '',
      '### ' + niche.title,
      '',
      'Source: ' + absolute('/find-clients/' + niche.slug),
      '',
      niche.quickAnswer,
      '',
      ...niche.where.map((s) => '- ' + s),
      '',
      niche.approach,
    )
  }
  for (const post of journal) {
    lines.push(
      '',
      '# ' + post.title,
      '',
      'Source: ' + absolute('/blog/' + post.slug),
      '',
      'By ' + post.author + '. Updated ' + post.updated + '.',
      '',
      post.quickAnswer,
      '',
      post.body.trim(),
    )
  }
  return lines.join('\n') + '\n'
}
