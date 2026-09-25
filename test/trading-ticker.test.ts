import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TradingTicker } from '../dist/trading-ticker.js'

const fixturePath = fileURLToPath(new URL('./fixtures/trading-ticker.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  payload: unknown[]
  expected: Record<string, unknown>
}

test('TradingTicker — unserializes a recorded REST /tickers row', () => {
  const result = TradingTicker.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('TradingTicker — exposes FIRST_TRADE at index 11', () => {
  const model = new TradingTicker(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.firstTrade, fixture.payload[11])
  assert.equal(typeof model.firstTrade, 'number')
})

test('TradingTicker — the pre-FIRST_TRADE indices are unchanged (regression)', () => {
  const model = new TradingTicker(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.symbol, fixture.payload[0])
  assert.equal(model.bid, fixture.payload[1])
  assert.equal(model.bidSize, fixture.payload[2])
  assert.equal(model.ask, fixture.payload[3])
  assert.equal(model.askSize, fixture.payload[4])
  assert.equal(model.dailyChange, fixture.payload[5])
  assert.equal(model.dailyChangePerc, fixture.payload[6])
  assert.equal(model.lastPrice, fixture.payload[7])
  assert.equal(model.volume, fixture.payload[8])
  assert.equal(model.high, fixture.payload[9])
  assert.equal(model.low, fixture.payload[10])
})

test('TradingTicker — a legacy 11-element row still parses, with firstTrade undefined', () => {
  const legacy = fixture.payload.slice(0, 11)
  const model = new TradingTicker(legacy) as unknown as Record<string, unknown>
  assert.equal(model.low, legacy[10])
  assert.equal(model.firstTrade, undefined)
})

test('TradingTicker — validate() accepts the recorded row', () => {
  assert.equal(TradingTicker.validate(fixture.payload), null)
})

test('TradingTicker — validate() accepts a null firstTrade (pair with no trades)', () => {
  const row = [...fixture.payload]
  row[11] = null
  assert.equal(TradingTicker.validate(row), null)
})

test('TradingTicker — validate() accepts a legacy row that omits firstTrade', () => {
  assert.equal(TradingTicker.validate(fixture.payload.slice(0, 11)), null)
})

test('TradingTicker — validate() rejects a malformed firstTrade', () => {
  const row = [...fixture.payload]
  row[11] = 'not-a-timestamp'
  const err = TradingTicker.validate(row)
  assert.ok(err instanceof Error)
  assert.match(err.message, /^firstTrade: /)
})

test('TradingTicker — serialize() round-trips firstTrade', () => {
  const model = new TradingTicker(fixture.payload)
  assert.deepEqual(model.serialize(), fixture.payload)
})

test('TradingTicker — quote()/base() split the symbol', () => {
  const model = new TradingTicker(fixture.payload)
  assert.equal(model.base(), 'BTC')
  assert.equal(model.quote(), 'USD')
})

test('TradingTicker — quote()/base() return "" on an unpopulated instance', () => {
  // Both read `this.symbol` through a `|| ''` fallback; a model built from an
  // empty payload must yield empty strings rather than throwing on substring.
  const empty = new TradingTicker()
  assert.equal(empty.base(), '')
  assert.equal(empty.quote(), '')
})

test('TradingTicker — unserializes a collection of rows', () => {
  const result = TradingTicker.unserialize([fixture.payload, fixture.payload]) as Record<string, unknown>[]
  assert.equal(result.length, 2)
  assert.equal(result[0].firstTrade, fixture.payload[11])
})
