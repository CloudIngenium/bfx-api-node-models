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
