import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TradingTickerChannel } from '../dist/trading-ticker-channel.js'
import { TradingTicker } from '../dist/trading-ticker.js'

const fixturePath = fileURLToPath(new URL('./fixtures/trading-ticker-channel.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  payload: unknown[]
  expected: Record<string, unknown>
}

test('TradingTickerChannel — unserializes a live WS ticker push', () => {
  const result = TradingTickerChannel.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('TradingTickerChannel — FIRST_TRADE reaches the WS channel too (index 10)', () => {
  const model = new TradingTickerChannel(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.firstTrade, fixture.payload[10])
})

test('TradingTickerChannel — every field sits one left of the REST model', () => {
  // The channel payload is subscription-scoped, so it omits SYMBOL. Applying
  // the symbol-prefixed TradingTicker map to it shifts every field by one —
  // this model exists precisely so consumers do not do that.
  const channel = new TradingTickerChannel(fixture.payload) as unknown as Record<string, unknown>
  const prefixed = new TradingTicker(['tBTCUSD', ...fixture.payload]) as unknown as Record<string, unknown>

  for (const key of ['bid', 'bidSize', 'ask', 'askSize', 'dailyChange',
    'dailyChangePerc', 'lastPrice', 'volume', 'high', 'low', 'firstTrade']) {
    assert.equal(channel[key], prefixed[key], `${key} must agree across both models`)
  }
})

test('TradingTickerChannel — validate() accepts the recorded push', () => {
  assert.equal(TradingTickerChannel.validate(fixture.payload), null)
})

test('TradingTickerChannel — validate() accepts a null firstTrade', () => {
  const row = [...fixture.payload]
  row[10] = null
  assert.equal(TradingTickerChannel.validate(row), null)
})

test('TradingTickerChannel — validate() rejects a malformed bid', () => {
  const row = [...fixture.payload]
  row[0] = 'not-a-price'
  const err = TradingTickerChannel.validate(row)
  assert.ok(err instanceof Error)
  assert.match(err.message, /^bid: /)
})

test('TradingTickerChannel — serialize() round-trips the payload', () => {
  const model = new TradingTickerChannel(fixture.payload)
  assert.deepEqual(model.serialize(), fixture.payload)
})
