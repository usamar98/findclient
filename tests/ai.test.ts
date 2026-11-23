import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseIntent, costUpperBound } from '../lib/ai'
const example = {
  score: 84,
  reason: 'The buyer asks for a quote.',
  problem_summary: 'Variant images fail to update.',
  budget_signal: 'Asks for an estimate',
  urgency: 'Before launch',
}
test('accepts a complete integer score and its supporting fields', () => {
  assert.deepEqual(parseIntent(JSON.stringify(example)), example)
})
test('rejects invalid, incomplete and out-of-range AI output', () => {
  for (const score of [-1, 101, '84', 4.5, null])
    assert.throws(() => parseIntent(JSON.stringify({ ...example, score })))
  assert.throws(() => parseIntent(JSON.stringify({ score: 90 })))
  assert.throws(() => parseIntent('not JSON'))
})
test('cost ceiling includes input framing, all input bytes and maximum output', () => {
  assert.equal(costUpperBound(744, 500, 1, 4), 0.003)
  assert.ok(costUpperBound(20000, 1000, 20, 30) > 0.05)
})
