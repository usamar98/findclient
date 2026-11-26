import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import test from 'node:test'

test('shared daily feed checks providers once across alert queries and respects a selected platform', () => {
  execFileSync(process.execPath, [
    '--conditions=react-server', '--require', 'tsx/cjs', join(__dirname, 'fixtures', 'daily-job-feed.ts'),
  ], { timeout: 30_000 })
})
