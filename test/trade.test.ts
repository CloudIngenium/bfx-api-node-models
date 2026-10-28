import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { Trade } from '../dist/index.js'

/**
 * Audit 2026-10-28 (models-trade-cid-05, models-validate-false-reject-06).
 *
 * Trade rows are authenticated, so no public recording exists: this row is
 * shaped exactly per docs.bitfinex.com/reference/rest-auth-trades
 * ([ID, SYMBOL, MTS, ORDER_ID, EXEC_AMOUNT, EXEC_PRICE, ORDER_TYPE,
 * ORDER_PRICE, MAKER, FEE, FEE_CURRENCY, CID]), the same convention
 * test/order.test.ts uses for order rows. ORDER_ID is an integer and CID is
 * an integer or null on the wire.
 */
const wireTradeRow = (cid: number | null): unknown[] => [
  402088407, 'tBTCUSD', 1793200000000, 1185815098, 0.01, 80000,
  'EXCHANGE LIMIT', 80000, 1, -0.16, 'USD', cid
]

describe('Trade: cid at index 11', () => {
  test('decodes cid from the 12th element', () => {
    const t = new Trade(wireTradeRow(1793199999001))
    assert.equal(t.cid, 1793199999001)
  })

  test('a null cid decodes as null and validates', () => {
    const row = wireTradeRow(null)
    assert.equal(new Trade(row).cid, null)
    assert.equal(Trade.validate(row), null)
  })

  test('an 11-element row (no CID) still validates', () => {
    assert.equal(Trade.validate(wireTradeRow(null).slice(0, 11)), null)
  })

  test('a non-numeric cid is rejected', () => {
    const err = Trade.validate(wireTradeRow('abc' as unknown as number))
    assert.match(String(err), /^Error: cid:/)
  })

  test('serialize() round-trips cid back to index 11', () => {
    const row = wireTradeRow(1793199999001)
    assert.equal(new Trade(row).serialize()[11], 1793199999001)
  })
})

describe('Trade: orderID is a number on the wire', () => {
  test('a documented row with a numeric ORDER_ID validates', () => {
    assert.equal(Trade.validate(wireTradeRow(1793199999001)), null)
  })

  test('a string orderID is rejected', () => {
    const row = wireTradeRow(null)
    row[3] = '1185815098'
    assert.match(String(Trade.validate(row)), /^Error: orderID:/)
  })
})

/**
 * A `te` (trade executed) event per docs.bitfinex.com/reference/ws-auth-trades:
 * the same 12 positions, with FEE and FEE_CURRENCY null because the fee is only
 * known on the following `tu` (trade update). Authenticated, so no recording
 * exists; the row is doc-shaped like wireTradeRow above.
 */
const wireTeRow: unknown[] = [
  402088407, 'tBTCUSD', 1793200000000, 1185815098, 0.01, 80000,
  'EXCHANGE LIMIT', 80000, 1, null, null, 1793199999001
]

describe('Trade: a te row has null FEE and FEE_CURRENCY', () => {
  test('the te row validates and decodes the fee fields as null', () => {
    assert.equal(Trade.validate(wireTeRow), null)
    const t = new Trade(wireTeRow)
    assert.equal(t.fee, null)
    assert.equal(t.feeCurrency, null)
  })

  test('the tu row (fees populated) still validates', () => {
    assert.equal(Trade.validate(wireTradeRow(1793199999001)), null)
  })

  test('a non-numeric fee and a malformed fee currency are still rejected', () => {
    const badFee = [...wireTeRow]
    badFee[9] = 'abc'
    assert.match(String(Trade.validate(badFee)), /^Error: fee:/)
    const badCcy = [...wireTeRow]
    badCcy[10] = 42
    assert.match(String(Trade.validate(badCcy)), /^Error: feeCurrency:/)
  })
})
