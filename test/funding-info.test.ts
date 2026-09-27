import assert from 'node:assert'
import { describe, test } from 'node:test'

import { FundingInfo } from '../dist/index.js'

/**
 * Funding info arrives as a tagged, nested row -- ['sym', <symbol>, [...]] --
 * so it carries no flat index map and is decoded by hand. That put it outside
 * every index-based test in this package and left it at 25% function
 * coverage.
 *
 * Two defects surfaced here, and they share a shape: `validate()` could not
 * return null for ANY input.
 *
 *   - It declares `fields: {}` because it has no index map, and Model.validate
 *     rejected every validator whose name was absent from `fields`. That
 *     guard is right for array rows and wrong for objects, which are read by
 *     name. Fixed in model.ts.
 *   - Its symbol is a FUNDING symbol (fUSD), and it was checked against
 *     `data/symbols.js`, all 193 entries of which are trading pairs. Fixed
 *     with validators/funding-symbol.ts.
 */
describe('FundingInfo: the tagged nested row', () => {
  const ROW = ['sym', 'fUSD', [0.0012, 0.0009, 30, 2]]

  test('unserialize names the nested yields and durations', () => {
    assert.deepStrictEqual(FundingInfo.unserialize(ROW), {
      symbol: 'fUSD', yieldLoan: 0.0012, yieldLend: 0.0009, durationLoan: 30, durationLend: 2
    })
  })

  test('the constructor exposes the same fields', () => {
    const fi = new FundingInfo(ROW)
    assert.strictEqual(fi.symbol, 'fUSD')
    assert.strictEqual(fi.yieldLend, 0.0009)
    assert.strictEqual(fi.durationLoan, 30)
  })

  test('serialize round-trips back to the wire shape', () => {
    assert.deepStrictEqual(new FundingInfo(ROW).serialize(), ROW)
    assert.deepStrictEqual(FundingInfo.unserialize(new FundingInfo(ROW).serialize()),
      FundingInfo.unserialize(ROW))
  })

  test('a collection of rows decodes element-wise', () => {
    const out = FundingInfo.unserialize([ROW, ['sym', 'fBTC', [1, 2, 3, 4]]])
    assert.strictEqual(Array.isArray(out), true)
    assert.deepStrictEqual((out as Record<string, unknown>[]).map(r => r.symbol), ['fUSD', 'fBTC'])
  })

  test('an object passes through untouched', () => {
    const obj = { symbol: 'fUSD', yieldLoan: 1 }
    assert.deepStrictEqual(FundingInfo.unserialize(obj), obj)
  })

  test('an unrecognised row decodes to an empty object rather than throwing', () => {
    assert.deepStrictEqual(FundingInfo.unserialize(['not-sym', 1, 2]), {})
    assert.deepStrictEqual(FundingInfo.unserialize('garbage'), {})
  })

  test('validate accepts its own unserialize output', () => {
    // The regression this file exists for: before the model.ts fix this
    // returned "symbol: no field index declared for this validator" -- the
    // model rejecting data it had just produced itself.
    assert.strictEqual(FundingInfo.validate(FundingInfo.unserialize(ROW)), null)
  })

  test('validate rejects a trading pair in the funding symbol slot', () => {
    const bad = { ...FundingInfo.unserialize(ROW) as Record<string, unknown>, symbol: 'tBTCUSD' }
    assert.ok(FundingInfo.validate(bad) instanceof Error)
  })

  test('validate rejects a non-numeric yield', () => {
    const bad = { ...FundingInfo.unserialize(ROW) as Record<string, unknown>, yieldLoan: 'lots' }
    assert.ok(FundingInfo.validate(bad) instanceof Error)
  })
})
