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
  // The full recorded row validates now that `symbol` is checked as a funding
  // symbol by format (it used to fail on the stale data/symbols.ts list).
  const result = FundingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.equal(result.frr, 0.0003708931506849315)
  assert.equal(FundingTicker.validate(fixture.payload), null)
})

test('FundingTicker — frrAmountAvailable and firstTrade complete the REST array', () => {
  const result = FundingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.equal(result.frrAmountAvailable, fixture.payload[16])
  assert.equal(result.firstTrade, fixture.payload[17])
})

test('FundingTicker — the constructor form decodes the same row, and round-trips it', () => {
  // Consumers build instances (`new FundingTicker(row)`), not only plain
  // objects via unserialize(), so the constructor path needs its own cover.
  const model = new FundingTicker(fixture.payload)
  const asRecord = model as unknown as Record<string, unknown>

  assert.equal(asRecord.symbol, fixture.payload[0])
  assert.equal(asRecord.frr, fixture.expected.frr)
  assert.equal(asRecord.bidPeriod, fixture.expected.bidPeriod)
  assert.equal(asRecord.bidSize, fixture.expected.bidSize)
  assert.equal(asRecord.firstTrade, fixture.expected.firstTrade)

  // Indices 14 and 15 are reserved on this endpoint; serialize() must refill
  // them as null so the wire row comes back byte-identical.
  assert.deepEqual(model.serialize(), fixture.payload)
})
