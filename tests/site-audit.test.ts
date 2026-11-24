import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzePage } from '../lib/site-audit/analyze'
import { publicSite, posterWebsite } from '../lib/site-audit/target'
import { publicAddress } from '../lib/site-audit/fetch'
import { replyContext } from '../lib/reply-context'

test('detects the buyer’s site, omits unrelated links, query strings and community profiles', () => {
  const source = 'https://www.reddit.com/r/webdev/post'
  const find = (body: string) => posterWebsite('Website redesign', body, source)
  assert.equal(
    find(
      'Our Shopify store is at https://example.org/store?ref=post. Can you help?',
    ),
    'https://example.org/store',
  )
  assert.equal(
    find('Client’s website: www.example.org'),
    'https://www.example.org/',
  )
  assert.equal(find('Looking for a site like https://sample.org'), null)
  assert.equal(find('Our site should look like this: https://sample.org'), null)
  assert.equal(find('My email is designer@example.org'), null)
  assert.equal(find('Our website: https://x.com/test'), null)
  for (const input of [
    'localhost',
    'https://192.168.1.1',
    'https://user:pass@site.org',
    'https://portal.internal',
    'https://site.org:7443',
  ]) {
    assert.equal(publicSite(input), null)
  }
})

test('the audit fetcher accepts publicly routed destinations only', () => {
  for (const ip of [
    '127.0.0.1',
    '169.254.169.254',
    '10.1.2.3',
    '172.20.1.2',
    '100.64.0.1',
    '::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2002::1',
    '2001:db8::1',
  ]) {
    assert.equal(publicAddress(ip), false, ip)
  }
  assert.ok(publicAddress('93.184.216.34'))
  assert.ok(publicAddress('2606:4700:4700::1111'))
})

test('a one-page audit reports observable issues and stays silent on passing checks', () => {
  const report = analyzePage(
    'https://example.org/',
    '<head><title>Store</title></head><h1>Store</h1><img src="hero.png">',
    84,
    1450,
  )
  assert.deepEqual(
    report.findings.map((f) => f.category),
    ['Speed', 'SEO', 'Design'],
  )
  assert.match(report.findings[0].evidence, /1.4|1.5/)
  const pass =
    '<head><title>Store</title><meta name="viewport" content="width=device-width"><meta name="description" content="Shop"></head><h1>Store</h1><img alt="" width="100" height="100">'
  assert.equal(
    analyzePage('https://example.org/', pass, 200, 100).findings.length,
    0,
  )
  const context = replyContext(
    ' My example ',
    ['Another reply', 'Another reply', ''],
    report,
  )
  assert.deepEqual(context.writingExamples, ['My example', 'Another reply'])
  assert.deepEqual(context.website?.findings, report.findings)
  assert.equal(replyContext('', [], null).website, null)
})
