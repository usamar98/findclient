import {
  platformAccessAnswer,
  platformBrowseAnswer,
  platformFreshnessAnswer,
  platformGuideAnswer,
  platformGuideRows,
  platformGuideUpdated,
  platformRuntimeAnswer,
  platformTimingNote,
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
    section + ' How does the 15-minute filter work?',
    '',
    platformFreshnessAnswer,
    '',
    section + ' When can Live Research recheck every minute?',
    '',
    platformWatchAnswer,
    '',
    section + ' How fresh are the results from each platform?',
    '',
    platformTimingNote,
    '',
    '[Source freshness by platform](' + absolute('/platforms#source-freshness') + ')',
    ...platformGuideRows.flatMap(
      (row) => ['', `**${row.name}** — ${row.detail} ${row.freshness} [${row.reference}](${row.url})`],
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
    section + ' What does search runtime measure?',
    '',
    platformRuntimeAnswer,
  ].join('\n')
}
