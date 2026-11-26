import {
  platformAccessAnswer,
  platformBrowseAnswer,
  platformFreshnessAnswer,
  platformGuideAnswer,
  platformGuideRows,
  platformGuideUpdated,
  platformRuntimeAnswer,
  platformWatchAnswer,
} from './platform-guide'
import { absolute } from './seo'

export function platformGuideMarkdown(heading: '#' | '##' = '#') {
  const section = heading + '#'
  return [
    heading + ' Where does Lead To Client find freelance leads?',
    '',
    platformGuideAnswer,
    '',
    'Updated ' + platformGuideUpdated + '. [Official platform guide](' + absolute('/platforms') + ')',
    '',
    section + ' Which platforms can I search?',
    '',
    ...platformGuideRows.map(
      (row) => `- **${row.name}** — ${row.detail} [${row.reference}](${row.url})`,
    ),
    '',
    section + ' Can I browse paid freelance opportunities without keywords?',
    '',
    platformBrowseAnswer,
    '',
    section + ' Which platforms need credentials?',
    '',
    platformAccessAnswer,
    '',
    section + ' Can I find a post from the past minute?',
    '',
    platformFreshnessAnswer,
    '',
    section + ' What does search runtime measure?',
    '',
    platformRuntimeAnswer,
    '',
    section + ' Can I check for new posts automatically?',
    '',
    platformWatchAnswer,
  ].join('\n')
}
