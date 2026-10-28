import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FundingTickerHist } from '../dist/funding-ticker-hist.js'

const fixturePath = fileURLToPath(new URL('./fixtures/funding-ticker-hist.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  _meta: { elements: number }
  payload: unknown[]
  expected: Record<string, unknown>
}

test('FundingTickerHist — unserializes a funding hist row', () => {
  const result = FundingTickerHist.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('FundingTickerHist — reads MTS_UPDATE from index 15, not the funding ticker\'s 17', () => {
  assert.equal(fixture.payload.length, fixture._meta.elements)
  const model = new FundingTickerHist(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.mtsUpdate, fixture.payload[15])
  assert.equal(typeof model.mtsUpdate, 'number')
})

test('FundingTickerHist — bid, bidPeriod and ask land on their declared indices', () => {
  const model = new FundingTickerHist(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.symbol, fixture.payload[0])
  assert.equal(model.bid, fixture.payload[2])
  assert.equal(model.bidPeriod, fixture.payload[4])
  assert.equal(model.ask, fixture.payload[5])
  assert.equal(model.bidPeriod, 120, 'bidPeriod is the small day-count, not a size')
})

test('FundingTickerHist — the recorded row validates unmodified, array and object form', () => {
  // Was asserted to fail on `symbol` while symbolValidator checked the stale
  // trading-pairs-only data/symbols.ts; `symbol` now uses the funding-symbol
  // format check, so the real fUSD row passes.
  assert.equal(FundingTickerHist.validate(fixture.payload), null)
  assert.equal(FundingTickerHist.validate(fixture.expected), null)
})

test('FundingTickerHist — a trading symbol is rejected on `symbol`', () => {
  const err = FundingTickerHist.validate({ ...fixture.expected, symbol: 'tBTCUSD' })
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'symbol: must be a funding symbol: f + a currency code')
})

test('FundingTickerHist — validate() rejects a malformed mtsUpdate', () => {
  const row = { ...fixture.expected, mtsUpdate: 'yesterday' }
  const err = FundingTickerHist.validate(row)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'mtsUpdate: must be a date or positive number')
})

test('FundingTickerHist — validate() rejects a malformed bid, bidPeriod and ask', () => {
  const base = { ...fixture.expected }

  assert.equal(
    (FundingTickerHist.validate({ ...base, bid: -1 }) as Error).message,
    'bid: must be a number greater than zero'
  )
  assert.equal(
    (FundingTickerHist.validate({ ...base, bidPeriod: '120' }) as Error).message,
    'bidPeriod: must be a number'
  )
  assert.equal(
    (FundingTickerHist.validate({ ...base, ask: 'free' }) as Error).message,
    'ask: must be a number greater than zero'
  )
})

test('FundingTickerHist — serialize() round-trips the row exactly', () => {
  const model = new FundingTickerHist(fixture.payload)
  assert.deepEqual(model.serialize(), fixture.payload)
})

test('FundingTickerHist — unserializes a collection of rows', () => {
  const result = FundingTickerHist.unserialize([fixture.payload, fixture.payload]) as Record<string, unknown>[]
  assert.equal(result.length, 2)
  assert.deepEqual(result[0], fixture.expected)
})

test('FundingTickerHist — an empty constructor payload yields no fields', () => {
  const model = new FundingTickerHist() as unknown as Record<string, unknown>
  assert.equal(model.symbol, undefined)
  assert.equal(model.mtsUpdate, undefined)
})
