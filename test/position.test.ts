import assert from 'node:assert'
import { describe, test } from 'node:test'

import { Position, Order } from '../dist/index.js'

/**
 * Positions were at 50% function coverage. The half that was not covered is
 * the half that acts: claiming, closing, and building the order that flattens
 * the position. `orderToClose()` in particular has to invert the sign and set
 * two flags -- get either wrong and it opens exposure instead of closing it.
 */
const ROW = (): unknown[] => {
  const r: unknown[] = []
  r[0] = 'tBTCUSD'; r[1] = 'ACTIVE'; r[2] = 1.5; r[3] = 20000; r[4] = 0
  r[5] = 'USD'; r[6] = 150; r[7] = 0.5; r[8] = 15000; r[9] = 3.3
  r[11] = 777; r[12] = 1600000000000; r[13] = 1600000000000
  r[15] = 'MARGIN'; r[17] = 5000; r[18] = 1000
  return r
}

describe('Position: decoding', () => {
  test('unserialize skips the placeholder slots and names the rest', () => {
    const p = Position.unserialize(ROW()) as Record<string, unknown>
    assert.strictEqual(p.symbol, 'tBTCUSD')
    assert.strictEqual(p.id, 777)
    assert.strictEqual(p.leverage, 3.3)
    assert.strictEqual(p.collateralMin, 1000)
  })

  test('validate accepts a well-formed row', () => {
    assert.strictEqual(Position.validate(ROW()), null)
  })

  test('validate rejects an untraded symbol', () => {
    const bad = ROW(); bad[0] = 'tNOPENOPE'
    assert.ok(Position.validate(bad) instanceof Error)
  })

  test('the status table is exposed', () => {
    assert.deepStrictEqual(
      { a: Position.status.ACTIVE, c: Position.status.CLOSED }, { a: 'ACTIVE', c: 'CLOSED' })
  })
})

describe('Position: orderToClose()', () => {
  test('a long is closed by a short market order', () => {
    const o = new Position(ROW()).orderToClose()
    assert.strictEqual(o.symbol, 'tBTCUSD')
    assert.strictEqual(o.type, Order.type.MARKET)
    assert.strictEqual(o.amount, -1.5, 'did not invert the sign: this would ADD exposure')
  })

  test('a short is closed by a long', () => {
    const row = ROW(); row[2] = -2
    assert.strictEqual(new Position(row).orderToClose().amount, 2)
  })

  test('the closing order is both reduce-only and position-close', () => {
    const o = new Position(ROW()).orderToClose()
    assert.strictEqual(o.isReduceOnly(), true)
    assert.strictEqual(o.isPositionClose(), true)
    assert.strictEqual(o.isOCO(), false)
  })
})

describe('Position: claim and close', () => {
  test('both refuse an interface that is not a RESTv2', async () => {
    const p = new Position(ROW())
    await assert.rejects(() => p.claim(), /only supported on RESTv2/)
    await assert.rejects(() => p.close(), /only supported on RESTv2/)
    await assert.rejects(() => p.claim({} as never), /only supported on RESTv2/)
  })

  test('claim sends the position id and applies the response', async () => {
    const seen: unknown[] = []
    const updated = ROW(); updated[1] = 'CLOSED'; updated[2] = 0
    const api = { claimPosition: async (a: unknown) => { seen.push(a); return updated } }
    const p = new Position(ROW(), api)
    assert.strictEqual(await p.claim(), p)
    assert.deepStrictEqual(seen, [{ id: 777 }])
    assert.strictEqual(p.status, 'CLOSED')
    assert.strictEqual(p.amount, 0)
  })

  test('close sends the id under the snake_case key the REST API expects', async () => {
    const seen: unknown[] = []
    const api = { closePosition: async (a: unknown) => { seen.push(a); return 'ok' } }
    assert.strictEqual(await new Position(ROW(), api).close(), 'ok')
    assert.deepStrictEqual(seen, [{ position_id: 777 }])
  })

  test('an interface passed at call time overrides the constructor one', async () => {
    const seen: string[] = []
    const ctor = { closePosition: async () => { seen.push('ctor'); return 1 } }
    const arg = { closePosition: async () => { seen.push('arg'); return 2 } }
    await new Position(ROW(), ctor).close(arg)
    assert.deepStrictEqual(seen, ['arg'])
  })
})

describe('Position: rendering', () => {
  test('toString names the market, size, base price, pl and liquidation', () => {
    const s = new Position(ROW()).toString()
    for (const part of ['(id: 777)', 'BTC/USD', '(ACTIVE)', '1.50000000',
      'base price 20000', 'pl', '150.00000000', 'liq', '15000']) {
      assert.ok(s.includes(part), `toString() omitted ${part}: ${s}`)
    }
  })
})
