import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FundingTicker } from '../dist/funding-ticker.js'

const fixturePath = fileURLToPath(new URL('./fixtures/funding-ticker.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  payload: unknown[]
  expected: Record<string, unknown>
}

test('FundingTicker — unserializes a recorded REST /tickers funding-row fixture (F5)', () => {
  const result = FundingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('FundingTicker — bidPeriod/bidSize and askPeriod/askSize are not swapped (regression)', () => {
  // Pre-fix this model read bidSize from index 3 (actually BID_PERIOD, a
  // small day-count) and bidPeriod from index 4 (actually BID_SIZE, a large
  // amount) — same swap for ask. Assert the magnitudes land on the field
  // that matches their real-world shape from the live capture.
  const result = FundingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.equal(result.bidPeriod, 120, 'bidPeriod should be the small day-count, not the size')
  assert.equal(result.bidSize, 27602507.19668174, 'bidSize should be the large amount, not the period')
  assert.equal(result.askPeriod, 2)
  assert.equal(result.askSize, 109932.77314575)
})

test('FundingTicker — frr is a rate (number), not a boolean (regression)', () => {
  // NOTE: FundingTicker.validate() on the full fixture still fails on the
  // `symbol` field — src/data/symbols.ts is a stale trading-pairs-only
  // snapshot with zero funding-currency (f-prefixed) entries. That gap
  // predates and is unrelated to this PR's scope (StatusMessagesDeriv +
  // funding-ticker/funding-channel models); flagged as a follow-up, not
  // fixed here. So this asserts the frr validator itself, not full validate().
  const result = FundingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.equal(result.frr, 0.0003708931506849315)
  const err = FundingTicker.validate(fixture.payload)
  assert.match((err as Error).message, /^symbol:/, 'only the known-gap symbol field should fail')
})

test('FundingTicker — frrAmountAvailable and firstTrade complete the REST array', () => {
  const result = FundingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.equal(result.frrAmountAvailable, fixture.payload[16])
  assert.equal(result.firstTrade, fixture.payload[17])
})
