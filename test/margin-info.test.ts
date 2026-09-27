import assert from 'node:assert'
import { describe, test } from 'node:test'

import { MarginInfo } from '../dist/index.js'

/**
 * One class, two wire shapes. `['base', [...]]` carries the account-wide
 * figures; `[<symbol>, <symbol>, [...]]` carries the per-pair ones. They share
 * no field between them, so every test here runs against whichever shape it
 * is actually about -- a single fixture would only ever cover one branch, and
 * this model sat at 25% functions for exactly that reason.
 */
describe('MarginInfo: the account-wide "base" shape', () => {
  const BASE = ['base', [100.5, 0, 5000, 4800]]

  test('unserialize names the four base figures', () => {
    assert.deepStrictEqual(MarginInfo.unserialize(BASE), {
      type: 'base', userPL: 100.5, userSwaps: 0, marginBalance: 5000, marginNet: 4800
    })
  })

  test('serialize round-trips', () => {
    assert.deepStrictEqual(new MarginInfo(BASE).serialize(), BASE)
  })

  test('validate accepts its own unserialize output', () => {
    assert.strictEqual(MarginInfo.validate(MarginInfo.unserialize(BASE)), null)
  })

  test('validate rejects a non-numeric balance', () => {
    const bad = { ...MarginInfo.unserialize(BASE) as Record<string, unknown>, marginBalance: 'lots' }
    assert.ok(MarginInfo.validate(bad) instanceof Error)
  })

  test('the base shape carries no per-symbol fields', () => {
    const m = MarginInfo.unserialize(BASE) as Record<string, unknown>
    assert.strictEqual(m.symbol, undefined)
    assert.strictEqual(m.tradableBalance, undefined)
  })
})

describe('MarginInfo: the per-symbol shape', () => {
  const SYM = ['sym', 'tBTCUSD', [1000, 2000, 0.5, -0.5]]

  test('unserialize names the four per-symbol figures', () => {
    assert.deepStrictEqual(MarginInfo.unserialize(SYM), {
      type: 'sym', symbol: 'tBTCUSD', tradableBalance: 1000, grossBalance: 2000, buy: 0.5, sell: -0.5
    })
  })

  test('serialize round-trips', () => {
    assert.deepStrictEqual(new MarginInfo(SYM).serialize(), SYM)
  })

  test('validate accepts its own unserialize output', () => {
    assert.strictEqual(MarginInfo.validate(MarginInfo.unserialize(SYM)), null)
  })

  test('validate rejects a symbol Bitfinex does not trade', () => {
    const bad = { ...MarginInfo.unserialize(SYM) as Record<string, unknown>, symbol: 'tNOPENOPE' }
    assert.ok(MarginInfo.validate(bad) instanceof Error)
  })

  test('the two shapes are told apart by the second element, not the first', () => {
    // 'base' is matched by tag; everything else is per-symbol only when a
    // symbol string actually sits in slot 1.
    assert.deepStrictEqual(MarginInfo.unserialize(['anything', 'tBTCUSD', [1, 2, 3, 4]]), {
      type: 'anything', symbol: 'tBTCUSD', tradableBalance: 1, grossBalance: 2, buy: 3, sell: 4
    })
    assert.deepStrictEqual(MarginInfo.unserialize(['anything', 99, [1, 2, 3, 4]]), {})
  })
})

describe('MarginInfo: shared decoding', () => {
  test('a collection decodes element-wise', () => {
    const out = MarginInfo.unserialize([['base', [1, 2, 3, 4]], ['sym', 'tBTCUSD', [5, 6, 7, 8]]])
    assert.deepStrictEqual((out as Record<string, unknown>[]).map(r => r.type), ['base', 'sym'])
  })

  test('an object passes through untouched', () => {
    const obj = { type: 'base', userPL: 1 }
    assert.deepStrictEqual(MarginInfo.unserialize(obj), obj)
  })

  test('an unrecognised row decodes to an empty object', () => {
    assert.deepStrictEqual(MarginInfo.unserialize('garbage'), {})
  })
})
