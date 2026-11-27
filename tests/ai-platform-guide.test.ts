import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { browseSourceNames, dailySourceNames, platformAccessAnswer, platformFreshnessAnswer, platformGuideRows, platformTimingNote, platformWatchAnswer } from '../lib/platform-guide'
import { platformGuideMarkdown } from '../lib/platform-guide-markdown'
import { faqGroups, homeFaq, howItWorksFaq, marketingFaq, pricingFaq } from '../lib/marketing-faq'
import { niches } from '../lib/niche-content'
import { dailyJobSources, keylessSources, paidSources, researchSourceLabels } from '../lib/research-catalog'
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
  for (const { id, items } of faqGroups) {
    assert.ok(directory.includes(absolute('/faq#' + id)))
    assert.ok(fullGuide.includes(absolute('/faq#' + id)))
    for (const { question, answer } of items) {
      assert.ok(fullGuide.includes(question + '\n\n' + answer), question)
    }
  }
  for (const niche of niches) {
    assert.ok(fullGuide.includes(absolute('/find-clients/' + niche.slug)))
    for (const phrase of niche.searchPhrases) assert.ok(fullGuide.includes(phrase), phrase)
    for (const { question, answer } of niche.faq) {
      assert.ok(fullGuide.includes(question + '\n\n' + answer), question)
    }
  }
})

test('FAQ navigation and page excerpts reference distinct questions in the public catalog', () => {
  assert.equal(new Set(faqGroups.map(group => group.id)).size, faqGroups.length)
  const questions = new Set(marketingFaq.map(item => item.question))
  assert.equal(questions.size, marketingFaq.length)
  const answers = new Map(marketingFaq.map(item => [item.question, item.answer]))
  for (const item of [...homeFaq, ...pricingFaq, ...howItWorksFaq]) {
    assert.equal(answers.get(item.question), item.answer)
  }
})

test('publication constraints and browse coverage are consistent across the public guide and FAQ', () => {
  for (const source of paidSources) assert.ok(browseSourceNames.includes(researchSourceLabels[source]))
  for (const source of dailyJobSources) assert.ok(dailySourceNames.includes(researchSourceLabels[source]))
  for (const source of keylessSources) assert.ok(platformAccessAnswer.includes(researchSourceLabels[source]))
  const guide = platformGuideMarkdown()
  const faq = marketingFaq.map(item => item.answer).join('\n')
  for (const text of [guide, faq]) {
    assert.match(text, /Jobicy.{0,100}three hours/i)
    assert.match(text, /at most hourly/i)
    assert.match(text, /(?:frilans|underkonsult)/i)
  }
})
