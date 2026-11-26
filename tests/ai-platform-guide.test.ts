import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { platformFreshnessAnswer, platformGuideRows, platformTimingNote, platformWatchAnswer } from '../lib/platform-guide'
import { platformGuideMarkdown } from '../lib/platform-guide-markdown'
import { researchSourceLabels } from '../lib/research-catalog'
import { absolute } from '../lib/seo'

test('the public AI guides cover every searchable platform and point to the HTML guide', () => {
  // The site reads journal files through a server-only module when building the AI guides.
  const documents = execFileSync(process.execPath, [
    '--conditions=react-server', '--require', 'tsx/cjs', '--eval',
    "const { llmsDocument } = require('./lib/llms'); process.stdout.write(JSON.stringify([llmsDocument(false), llmsDocument(true)]))",
  ], { encoding: 'utf8' })
  const [directory, fullGuide]: [string, string] = JSON.parse(documents)
  const markdown = platformGuideMarkdown()
  for (const document of [directory, fullGuide, markdown]) {
    assert.ok(document.includes(absolute('/platforms')))
    assert.ok(document.includes(absolute('/platforms#source-freshness')))
  }
  const platformEntry = directory.split('\n').find((line) => line.includes(`](${absolute('/platforms')})`))
  assert.ok(platformEntry)
  assert.ok(platformEntry.endsWith(Object.values(researchSourceLabels).join(', ') + '.'))
  assert.ok(directory.includes(absolute('/guides/platforms.md')))
  for (const document of [markdown, fullGuide]) {
    assert.ok(document.includes(platformFreshnessAnswer))
    assert.ok(document.includes(platformWatchAnswer))
    assert.ok(document.includes(platformTimingNote))
    const paragraphs = document.split('\n\n')
    for (const row of platformGuideRows) {
      const entry = paragraphs.find(paragraph => paragraph.startsWith(`**${row.name}**`))
      assert.ok(entry, `Missing platform: ${row.name}`)
      assert.ok(entry.includes(row.detail), `Missing coverage for ${row.name}`)
      assert.ok(row.freshness?.trim() && entry.includes(row.freshness), `Missing freshness for ${row.name}`)
      assert.ok(entry.includes(`[${row.reference}](${row.url})`), `Missing source for ${row.name}`)
    }
  }
})
