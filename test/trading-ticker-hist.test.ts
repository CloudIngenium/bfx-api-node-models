import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TradingTickerHist } from '../dist/trading-ticker-hist.js'

const fixturePath = fileURLToPath(new URL('./fixtures/trading-ticker-hist.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  _meta: { elements: number }
  payload: unknown[]
  expected: Record<string, unknown>
}

test('TradingTickerHist — unserializes a recorded REST /tickers/hist row', () => {
  const result = TradingTickerHist.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('TradingTickerHist — reads MTS_UPDATE from index 12, past eight placeholders', () => {
  assert.equal(fixture.payload.length, fixture._meta.elements)
  const model = new TradingTickerHist(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.mtsUpdate, fixture.payload[12])
  assert.equal(typeof model.mtsUpdate, 'number')
})

test('TradingTickerHist — bid and ask straddle the _PLACEHOLDER at index 2', () => {
  const model = new TradingTickerHist(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.symbol, fixture.payload[0])
  assert.equal(model.bid, fixture.payload[1])
  assert.equal(model.ask, fixture.payload[3])
  assert.equal(fixture.payload[2], null, 'index 2 is a placeholder on this endpoint')
})

test('TradingTickerHist — validate() returns null for a real row (regression)', () => {
  // The validator key was `mtsUpdated` while the field is `mtsUpdate`. That
  // typo made validate() reject EVERY input — the validator read the payload
  // at index `undefined`, got undefined, and dateValidator rejected it — so
  // no caller could ever validate a correct hist row. Assert the fix directly.
  assert.equal(TradingTickerHist.validate(fixture.payload), null)
})

test('TradingTickerHist — validate() still rejects a malformed mtsUpdate', () => {
  // The counterpart to the regression above: fixing the key must not turn the
  // check into a no-op that passes everything.
  const row = [...fixture.payload]
  row[12] = 'yesterday'
  const err = TradingTickerHist.validate(row)
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'mtsUpdate: must be a date or positive number')
})

test('TradingTickerHist — validate() rejects a malformed bid, ask and symbol', () => {
  const badBid = [...fixture.payload]
  badBid[1] = -1
  assert.match((TradingTickerHist.validate(badBid) as Error).message, /^bid: /)

  const badAsk = [...fixture.payload]
  badAsk[3] = 'cheap'
  assert.match((TradingTickerHist.validate(badAsk) as Error).message, /^ask: /)

  const badSymbol = [...fixture.payload]
  badSymbol[0] = 'tNOPEUSD'
  assert.match((TradingTickerHist.validate(badSymbol) as Error).message, /^symbol: /)
})

test('TradingTickerHist — serialize() round-trips the recorded row exactly', () => {
  const model = new TradingTickerHist(fixture.payload)
  assert.deepEqual(model.serialize(), fixture.payload)
})

test('TradingTickerHist — unserializes a collection of rows', () => {
  const result = TradingTickerHist.unserialize([fixture.payload, fixture.payload]) as Record<string, unknown>[]
  assert.equal(result.length, 2)
  assert.deepEqual(result[0], fixture.expected)
  assert.deepEqual(result[1], fixture.expected)
})

test('TradingTickerHist — validate() accepts a collection of real rows', () => {
  assert.equal(TradingTickerHist.validate([fixture.payload, fixture.payload]), null)
})

test('TradingTickerHist — an empty constructor payload yields no fields', () => {
  const model = new TradingTickerHist() as unknown as Record<string, unknown>
  assert.equal(model.symbol, undefined)
  assert.equal(model.mtsUpdate, undefined)
})
