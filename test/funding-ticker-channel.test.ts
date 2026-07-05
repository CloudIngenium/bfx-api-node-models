import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FundingTickerChannel } from '../dist/funding-ticker-channel.js'

const fixturePath = fileURLToPath(new URL('./fixtures/funding-ticker-channel.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  payload: unknown[]
  expected: Record<string, unknown>
}

test('FundingTickerChannel — unserializes a recorded WS fticker-shaped fixture (F5)', () => {
  const result = FundingTickerChannel.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('FundingTickerChannel — validate() accepts the WS-shaped payload (no symbol at index 0)', () => {
  const err = FundingTickerChannel.validate(fixture.payload)
  assert.equal(err, null)
})

test('FundingTickerChannel — closes the LendingBot WebSocketManager._process_funding_ticker gap', () => {
  // LendingBot's hand-decoder reads data[0..9] (frr..lastPrice) and drops
  // volume/high/low/frrAmountAvailable. Assert this model exposes all of it.
  const model = new FundingTickerChannel(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.volume, fixture.payload[10])
  assert.equal(model.high, fixture.payload[11])
  assert.equal(model.low, fixture.payload[12])
  assert.equal(model.frrAmountAvailable, fixture.payload[15])
})
