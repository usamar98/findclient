import { lookup } from 'node:dns/promises'
import { get } from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { IncomingMessage } from 'node:http'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import robotsParser from 'robots-parser'
import { analyzePage } from './analyze'
import { publicSite } from './target'

const excluded = new BlockList()
for (const [address, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  excluded.addSubnet(address, bits, 'ipv4')
for (const [address, bits] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  excluded.addSubnet(address, bits, 'ipv6')

export function publicAddress(address: string) {
  const family = isIP(address)
  if (family === 4) return !excluded.check(address, 'ipv4')
  return (
    family === 6 && /^[23]/i.test(address) && !excluded.check(address, 'ipv6')
  )
}

async function requestPage(url: URL, signal: AbortSignal) {
  const started = performance.now()
  const addresses = await lookup(url.hostname, { all: true })
  if (
    !addresses.length ||
    addresses.some((entry) => !publicAddress(entry.address))
  )
    throw new Error('Website does not resolve to a public address.')
  const address = addresses.find((entry) => entry.family === 4) ?? addresses[0]
  signal.throwIfAborted()
  // Connect to the checked address. Preserve the original host for HTTP, SNI and TLS verification.
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    get(
      {
        hostname: address.address,
        path: url.pathname + url.search,
        servername: url.hostname,
        agent: false,
        signal,
        headers: {
          host: url.host,
          'user-agent': 'LeadToClientAudit/1.0',
          accept: 'text/html, application/xhtml+xml, text/plain',
          'accept-encoding': 'identity',
        },
      },
      resolve,
    ).once('error', reject)
  })
  return { response, elapsed: Math.round(performance.now() - started) }
}

async function readText(response: IncomingMessage, limit: number) {
  const codec = response.headers['content-encoding']
  const decoded =
    codec === 'gzip'
      ? createGunzip()
      : codec === 'br'
        ? createBrotliDecompress()
        : codec === 'deflate'
          ? createInflate()
          : null
  const stream = decoded ? response.pipe(decoded) : response
  if (decoded) response.once('error', (err) => decoded.destroy(err))
  const chunks: Buffer[] = []
  let bytes = 0
  try {
    for await (const chunk of stream) {
      const part = Buffer.from(chunk)
      bytes += part.length
      if (bytes > limit)
        throw new Error('Page exceeds the quick audit size limit.')
      chunks.push(part)
    }
    return { text: Buffer.concat(chunks).toString('utf8'), bytes }
  } finally {
    stream.destroy()
    response.destroy()
  }
}

async function checkRobots(url: URL, signal: AbortSignal) {
  const original = new URL('/robots.txt', url)
  let robots: URL | null = original
  for (let hop = 0; robots && hop <= 3; hop++) {
    const { response } = await requestPage(robots, signal)
    const status = response.statusCode ?? 0
    if (status === 404 || status === 410) {
      response.destroy()
      return
    }
    if (
      [301, 302, 303, 307, 308].includes(status) &&
      response.headers.location
    ) {
      response.destroy()
      robots = publicSite(new URL(response.headers.location, robots).href)
      continue
    }
    if (status < 200 || status >= 300) {
      response.destroy()
      break
    }
    const { text } = await readText(response, 512 * 1024)
    const rules = robotsParser(original.href, text)
    if (['LeadToClientAudit', 'ClientfindAudit'].some(agent => rules.isAllowed(url.href, agent) === false))
      throw new Error('This site disallows the audit crawler.')
    return
  }
  throw new Error('Unable to confirm crawling permission.')
}

export async function inspectWebsite(input: string) {
  let url = publicSite(input)
  const signal = AbortSignal.timeout(14000)
  for (let hop = 0; url && hop <= 3; hop++) {
    await checkRobots(url, signal)
    const { response, elapsed } = await requestPage(url, signal)
    const status = response.statusCode ?? 0
    if (
      [301, 302, 303, 307, 308].includes(status) &&
      response.headers.location
    ) {
      response.destroy()
      url = publicSite(new URL(response.headers.location, url).href)
      continue
    }
    if (
      status !== 200 ||
      !/^(text\/html|application\/xhtml\+xml)\b/i.test(
        response.headers['content-type'] ?? '',
      )
    ) {
      response.destroy()
      throw new Error('The site did not return a public HTML page.')
    }
    const { text, bytes } = await readText(response, 2 * 1024 * 1024)
    return analyzePage(url.href, text, bytes, elapsed)
  }
  throw new Error('A public website could not be reached.')
}
