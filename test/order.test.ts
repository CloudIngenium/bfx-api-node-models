import assert from 'node:assert'
import { describe, test } from 'node:test'

import { Order } from '../dist/index.js'

/**
 * The order model -- the one model in this package that a caller *mutates and
 * then sends back to the exchange*.
 *
 * It sat at 9.30% function coverage, the lowest in the package and by some
 * distance the largest file. Every other model here is a decode: an array in,
 * named fields out. This one carries an API interface, rewrites its own fields
 * from partial updates, maintains a bitfield by arithmetic, and renders the
 * packet that actually places money at risk. A wrong answer here is not a
 * mis-displayed row; it is an order the exchange receives and fills.
 *
 * Three properties get asserted directly rather than inferred:
 *
 *   - `modifyFlag` maintains the bitfield with `+=`/`-=`, not `|=`/`&= ~`.
 *     That is only correct while it is perfectly guarded against
 *     double-application, so idempotency is tested rather than assumed.
 *   - `toNewOrderPacket()` copies `meta` before injecting `aff_code`. If it
 *     ever aliases instead, building a packet would silently mutate the order
 *     it was built from, and the second packet would differ from the first.
 *   - `update()` must not forward a change it has already rejected.
 *
 * The OCO/`price_aux_limit` split is covered on both sides: the same field
 * leaves under two different wire names depending on one flag bit.
 */

/** Records every call so a test can assert what reached the wire. */
const fakeApi = (overrides: Record<string, unknown> = {}): any => {
  const calls: Record<string, unknown[][]> = {}
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ||= []).push(args)
    return undefined
  }
  return {
    calls,
    updateOrder: async (...a: unknown[]) => { (calls.updateOrder ||= []).push(a); return 'updated' },
    submitOrder: async (...a: unknown[]) => { (calls.submitOrder ||= []).push(a); return [] },
    cancelOrder: async (...a: unknown[]) => { (calls.cancelOrder ||= []).push(a); return 'cancelled' },
    onOrderNew: record('onOrderNew'),
    onOrderUpdate: record('onOrderUpdate'),
    onOrderClose: record('onOrderClose'),
    removeListeners: record('removeListeners'),
    ...overrides
  }
}

describe('Order: the flag bitfield', () => {
  test('flags default to 0 rather than undefined', () => {
    assert.strictEqual(new Order({ symbol: 'tBTCUSD' }).flags, 0)
  })

  test('setting a flag twice does not add the bit twice', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    assert.strictEqual(o.setPostOnly(true), Order.flags.POSTONLY)
    // The second call must be a no-op. `modifyFlag` adds by arithmetic, so a
    // missing guard would leave flags at 2x the bit -- a different flag set.
    assert.strictEqual(o.setPostOnly(true), undefined)
    assert.strictEqual(o.flags, Order.flags.POSTONLY)
  })

  test('clearing a flag removes exactly its own bit', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setPostOnly(true)
    o.setReduceOnly(true)
    assert.strictEqual(o.flags, Order.flags.POSTONLY + Order.flags.REDUCE_ONLY)
    o.setPostOnly(false)
    assert.strictEqual(o.flags, Order.flags.REDUCE_ONLY)
    assert.strictEqual(o.isPostOnly(), false)
    assert.strictEqual(o.isReduceOnly(), true)
  })

  test('clearing a flag that is not set is a no-op', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    assert.strictEqual(o.setPostOnly(false), undefined)
    assert.strictEqual(o.flags, 0)
  })

  test('every predicate reads only its own bit', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setPostOnly(true)
    o.setReduceOnly(true)
    o.setPositionClose(true)
    o.setHidden(true)
    o.setNoVariableRates(true)
    o.setOCO(true, 100, 5)

    assert.deepStrictEqual({
      postOnly: o.isPostOnly(),
      reduceOnly: o.isReduceOnly(),
      positionClose: o.isPositionClose(),
      hidden: o.isHidden(),
      oco: o.isOCO(),
      variableRates: o.includesVariableRates()
    }, {
      postOnly: true,
      reduceOnly: true,
      positionClose: true,
      hidden: true,
      oco: true,
      // inverted on purpose: the NO_VR bit means "does NOT include"
      variableRates: false
    })
  })

  test('variable rates are included by default', () => {
    assert.strictEqual(new Order({ symbol: 'fUSD' }).includesVariableRates(), true)
  })
})

describe('Order: hidden and visible-on-hit are ordered', () => {
  test('visible-on-hit is silently refused while the order is not hidden', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    assert.strictEqual(o.setVisibleOnHit(true), undefined)
    assert.strictEqual(o.isVisibleOnHit(), false)
    assert.strictEqual(o.meta, undefined)
  })

  test('visible-on-hit applies once the order is hidden, as the numeric flag', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setHidden(true)
    assert.deepStrictEqual(o.setVisibleOnHit(true), { make_visible: 1 })
    assert.strictEqual(o.isVisibleOnHit(), true)
  })

  test('a non-boolean is refused even when hidden', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setHidden(true)
    assert.strictEqual(o.setVisibleOnHit(1 as unknown as boolean), undefined)
    assert.strictEqual(o.isVisibleOnHit(), false)
  })

  test('un-hiding drops make_visible rather than leaving it stranded', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setHidden(true)
    o.setVisibleOnHit(true)
    o.setHidden(false)
    assert.deepStrictEqual(o.meta, {})
    assert.strictEqual(o.isVisibleOnHit(), false)
  })

  test('the constructor applies hidden before visibleOnHit', () => {
    // Both arrive in one object, so this only works if the constructor orders
    // them. Reversed, visibleOnHit would hit the not-hidden refusal above.
    const o = new Order({ symbol: 'tBTCUSD', hidden: true, visibleOnHit: true })
    assert.strictEqual(o.isHidden(), true)
    assert.strictEqual(o.isVisibleOnHit(), true)
  })
})

describe('Order: OCO', () => {
  test('enabling records the stop price and companion cid', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setOCO(true, 21000, 99)
    assert.strictEqual(o.isOCO(), true)
    assert.strictEqual(o.priceAuxLimit, 21000)
    assert.strictEqual(o.cidOCO, 99)
  })

  test('disabling clears the flag and leaves the stop price in place', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    o.setOCO(true, 21000, 99)
    o.setOCO(false)
    assert.strictEqual(o.isOCO(), false)
    // Deliberately pinned: the price is NOT cleared. toNewOrderPacket() then
    // sends it as price_aux_limit instead of price_oco_stop.
    assert.strictEqual(o.priceAuxLimit, 21000)
  })

  test('the constructor honours an oco payload', () => {
    const o = new Order({ symbol: 'tBTCUSD', oco: true, priceAuxLimit: 100, cidOCO: 7 })
    assert.strictEqual(o.isOCO(), true)
    assert.strictEqual(o.cidOCO, 7)
  })
})

describe('Order: the new-order packet', () => {
  const base = { symbol: 'tBTCUSD', amount: 1.5, price: 21000.123456, type: 'LIMIT', gid: 7, cid: 3 }

  test('amounts are fixed-decimal and prices significant-figure strings', () => {
    const p = new Order(base).toNewOrderPacket()
    assert.strictEqual(p.amount, '1.50000000')
    assert.strictEqual(p.price, '21000')
    assert.strictEqual(p.flags, 0)
  })

  test('a non-OCO aux limit leaves as price_aux_limit', () => {
    const p = new Order({ ...base, priceAuxLimit: 20000 }).toNewOrderPacket()
    assert.strictEqual(p.price_aux_limit, '20000')
    assert.strictEqual(p.price_oco_stop, undefined)
    assert.strictEqual(p.cid_oco, undefined)
  })

  test('the same field leaves as price_oco_stop once the OCO bit is set', () => {
    const o = new Order({ ...base })
    o.setOCO(true, 20000, 42)
    const p = o.toNewOrderPacket()
    assert.strictEqual(p.price_oco_stop, '20000')
    assert.strictEqual(p.cid_oco, 42)
    assert.strictEqual(p.price_aux_limit, undefined)
  })

  test('a trailing price is emitted when present', () => {
    const p = new Order({ ...base, priceTrailing: 50 }).toNewOrderPacket()
    assert.strictEqual(p.price_trailing, '50.000')
  })

  test('the affiliate code rides in meta without mutating the order', () => {
    const o = new Order({ ...base, affiliateCode: 'abc123' })
    const first = o.toNewOrderPacket()
    assert.deepStrictEqual(first.meta, { aff_code: 'abc123' })
    // The order's own meta must be untouched -- otherwise the second packet
    // would be built from an order the first packet had already modified.
    assert.deepStrictEqual(o.meta, undefined)
    assert.deepStrictEqual(o.toNewOrderPacket().meta, { aff_code: 'abc123' })
  })

  test('an empty affiliate code is not injected', () => {
    const p = new Order({ ...base, affiliateCode: '' }).toNewOrderPacket()
    assert.deepStrictEqual(p.meta, {})
  })

  test('a finite cid is preserved', () => {
    assert.strictEqual(new Order({ ...base, cid: 3 }).toNewOrderPacket().cid, 3)
  })

  test('a missing cid is generated, and successive packets do not collide', () => {
    const a = new Order({ symbol: 'tBTCUSD', amount: 1, type: 'LIMIT' }).toNewOrderPacket()
    const b = new Order({ symbol: 'tBTCUSD', amount: 1, type: 'LIMIT' }).toNewOrderPacket()
    assert.strictEqual(Number.isFinite(a.cid as number), true)
    assert.notStrictEqual(a.cid, b.cid)
  })
})

describe('Order: update()', () => {
  test('refuses to run with no API interface', async () => {
    await assert.rejects(
      () => new Order({ symbol: 'tBTCUSD' }).update({ price: 1 }),
      /no ws client available/
    )
  })

  test('a delta against a missing amount rejects and sends nothing', async () => {
    // Regression: this used to `return Promise.reject(...)` from inside a
    // `forEach` callback. The return value was discarded, so update() resolved
    // normally, the bad delta was forwarded to the exchange anyway, and the
    // orphaned rejection terminated the process.
    const api = fakeApi()
    const o = new Order({ id: 1, symbol: 'tBTCUSD' }, api)
    assert.strictEqual(Number.isNaN(+o.amount), true)

    await assert.rejects(() => o.update({ delta: 5 }), /can't apply delta to missing amount/)
    assert.strictEqual(api.calls.updateOrder, undefined,
      'rejected the change and then sent it anyway')
  })

  test('a delta against a real amount accumulates and tracks the fill baseline', async () => {
    const api = fakeApi()
    const o = new Order({ id: 1, symbol: 'tBTCUSD', amount: 2 }, api)
    await o.update({ delta: 3 }, api)
    assert.strictEqual(o.amount, 5)
    assert.strictEqual(o.getLastFillAmount(), 0)
  })

  test('the underscored wire names map onto the camelCase fields', async () => {
    const api = fakeApi()
    const o = new Order({ id: 1, symbol: 'tBTCUSD', amount: 1 }, api)
    await o.update({ price_trailing: 12, price_aux_limit: 34 }, api)
    assert.strictEqual(o.priceTrailing, 12)
    assert.strictEqual(o.priceAuxLimit, 34)

    await o.update({ price_oco_stop: 56 }, api)
    assert.strictEqual(o.priceAuxLimit, 56)
  })

  test('id in the changes is ignored, but stamped onto the outgoing payload', async () => {
    const api = fakeApi()
    const o = new Order({ id: 111, symbol: 'tBTCUSD', amount: 1 }, api)
    await o.update({ id: 999, price: 10 }, api)
    assert.strictEqual(o.id, 111, 'let a change rewrite the order id')
    assert.strictEqual((api.calls.updateOrder[0][0] as Record<string, unknown>).id, 111)
  })

  test('known fields are assigned and the payload is precision-formatted', async () => {
    const api = fakeApi()
    const o = new Order({ id: 1, symbol: 'tBTCUSD', amount: 1 }, api)
    await o.update({ price: 21000.123456, amount: 2.5 }, api)
    assert.strictEqual(o.price, 21000.123456)
    assert.deepStrictEqual(api.calls.updateOrder[0][0], {
      id: 1, price: '21000', amount: '2.50000000'
    })
  })

  test('falls back to the interface supplied at construction', async () => {
    const api = fakeApi()
    const o = new Order({ id: 1, symbol: 'tBTCUSD', amount: 1 }, api)
    assert.strictEqual(await o.update({ price: 1 }), 'updated')
  })
})

describe('Order: updateFrom()', () => {
  test('copies the mutable fields off a matching order', () => {
    const o = new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD', amount: 1 })
    o.updateFrom(new Order({ id: 1, gid: 2, cid: 3, amount: 0.5, status: 'PARTIALLY FILLED', mtsUpdate: 42, priceAvg: 99 }))
    assert.deepStrictEqual(
      { amount: o.amount, status: o.status, mtsUpdate: o.mtsUpdate, priceAvg: o.priceAvg },
      { amount: 0.5, status: 'PARTIALLY FILLED', mtsUpdate: 42, priceAvg: 99 }
    )
  })

  test('refuses an order from a different group', () => {
    const o = new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD' })
    assert.throws(
      () => o.updateFrom(new Order({ id: 1, gid: 77, cid: 3 })),
      /order IDs do not match/
    )
  })

  test('refuses an order whose id and cid both differ', () => {
    const o = new Order({ id: 1, cid: 3, symbol: 'tBTCUSD' })
    assert.throws(
      () => o.updateFrom(new Order({ id: 9, cid: 9 })),
      /order IDs do not match/
    )
  })
})

describe('Order: fill accounting', () => {
  test('the last fill is the amount consumed since the previous reset', () => {
    const o = new Order({ symbol: 'tBTCUSD', amount: 10 })
    assert.strictEqual(o.getLastFillAmount(), 0)
    o.amount = 7
    assert.strictEqual(o.getLastFillAmount(), 3)
    o.resetFilledAmount()
    assert.strictEqual(o.getLastFillAmount(), 0)
  })

  test('amountOrig defaults to the opening amount', () => {
    assert.strictEqual(new Order({ symbol: 'tBTCUSD', amount: 4 }).amountOrig, 4)
  })

  test('partially filled is strictly between untouched and complete', () => {
    const at = (amount: number): boolean =>
      new Order({ symbol: 'tBTCUSD', amount, amountOrig: 10 }).isPartiallyFilled()
    assert.deepStrictEqual([at(10), at(4), at(0)], [false, true, false])
  })

  test('a short order is measured on magnitude, not sign', () => {
    assert.strictEqual(
      new Order({ symbol: 'tBTCUSD', amount: -4, amountOrig: -10 }).isPartiallyFilled(), true)
  })

  test('the notional value is unsigned', () => {
    assert.strictEqual(
      new Order({ symbol: 'tBTCUSD', amount: -2, price: 100 }).getNotionalValue(), 200)
  })
})

describe('Order: currency pairs', () => {
  test('an instance splits its own symbol', () => {
    const o = new Order({ symbol: 'tBTCUSD' })
    assert.deepStrictEqual([o.getBaseCurrency(), o.getQuoteCurrency()], ['BTC', 'USD'])
  })

  test('the statics read the symbol out of a raw row and upcase it', () => {
    const row = [1, 2, 3, 'tbtcusd']
    assert.deepStrictEqual(
      [Order.getBaseCurrency(row), Order.getQuoteCurrency(row)], ['BTC', 'USD'])
  })

  test('the statics tolerate an empty row', () => {
    assert.deepStrictEqual([Order.getBaseCurrency(), Order.getQuoteCurrency()], ['', ''])
  })
})

describe('Order: websocket listeners', () => {
  class WSv2 {
    calls: Record<string, unknown[][]> = {}
    private rec (n: string) { return (...a: unknown[]) => { (this.calls[n] ||= []).push(a) } }
    onOrderNew = this.rec('onOrderNew')
    onOrderUpdate = this.rec('onOrderUpdate')
    onOrderClose = this.rec('onOrderClose')
    removeListeners = this.rec('removeListeners')
  }

  test('registration is refused for anything that is not a WSv2', () => {
    const api = fakeApi()
    new Order({ id: 1, symbol: 'tBTCUSD' }).registerListeners(api)
    assert.deepStrictEqual(api.calls, {})
  })

  test('the channel filter carries only the finite identifiers', () => {
    const ws = new WSv2()
    new Order({ id: 1, gid: 2, symbol: 'tBTCUSD' }, ws as any).registerListeners()
    assert.deepStrictEqual(ws.calls.onOrderNew[0][0], {
      symbol: 'tBTCUSD', cbGID: '2.undefined', id: 1, gid: 2
    })
  })

  test('all three order channels are subscribed', () => {
    const ws = new WSv2()
    new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD' }, ws as any).registerListeners()
    assert.deepStrictEqual(
      Object.keys(ws.calls).sort(), ['onOrderClose', 'onOrderNew', 'onOrderUpdate'])
  })

  test('removal is keyed on the same cbGID that registration used', () => {
    const ws = new WSv2()
    const o = new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD' }, ws as any)
    o.registerListeners()
    o.removeListeners()
    assert.deepStrictEqual(ws.calls.removeListeners, [[o.cbGID()]])
    assert.strictEqual(o.cbGID(), '2.3')
  })

  test('removal with no interface at all is a no-op rather than a throw', () => {
    assert.doesNotThrow(() => new Order({ symbol: 'tBTCUSD' }).removeListeners())
  })

  test('a close event emits update and then close, with the order applied', () => {
    const ws = new WSv2()
    const o = new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD', amount: 5 }, ws as any)
    o.registerListeners()

    const seen: string[] = []
    o.on('update', () => seen.push('update'))
    o.on('close', () => seen.push('close'))

    const row: unknown[] = []
    row[0] = 1; row[3] = 'tBTCUSD'; row[6] = 0; row[13] = 'EXECUTED'
    ;(ws.calls.onOrderClose[0][1] as (o: unknown) => void)(row)

    assert.deepStrictEqual(seen, ['update', 'close'])
    assert.strictEqual(o.status, 'EXECUTED')
    assert.strictEqual(o.amount, 0)
  })

  test('a new event emits update and then new', () => {
    const ws = new WSv2()
    const o = new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD' }, ws as any)
    o.registerListeners()
    const seen: string[] = []
    o.on('update', () => seen.push('update'))
    o.on('new', () => seen.push('new'))
    ;(ws.calls.onOrderNew[0][1] as (o: unknown) => void)([])
    assert.deepStrictEqual(seen, ['update', 'new'])
  })

  test('an update event emits update alone', () => {
    const ws = new WSv2()
    const o = new Order({ id: 1, gid: 2, cid: 3, symbol: 'tBTCUSD' }, ws as any)
    o.registerListeners()
    const seen: string[] = []
    o.on('update', () => seen.push('update'))
    o.on('close', () => seen.push('close'))
    o.on('new', () => seen.push('new'))
    ;(ws.calls.onOrderUpdate[0][1] as (o: unknown) => void)([])
    assert.deepStrictEqual(seen, ['update'])
  })
})

describe('Order: submit, cancel, recreate', () => {
  test('each refuses to act with no API interface', async () => {
    const o = new Order({ id: 1, symbol: 'tBTCUSD' })
    await assert.rejects(() => o.submit(), /no API interface provided/)
    await assert.rejects(() => o.cancel(), /no API interface provided/)
    await assert.rejects(() => o.recreate(), /no API interface provided/)
  })

  test('cancelling needs an id', async () => {
    const api = fakeApi()
    await assert.rejects(() => new Order({ symbol: 'tBTCUSD' }, api).cancel(), /order has no ID/)
    assert.strictEqual(api.calls.cancelOrder, undefined)
  })

  test('submit applies the exchange row back onto the order', async () => {
    const row: unknown[] = []
    row[0] = 555; row[3] = 'tBTCUSD'; row[13] = 'ACTIVE'
    const api = fakeApi({ submitOrder: async () => row })
    const o = new Order({ symbol: 'tBTCUSD', amount: 1 }, api)
    assert.strictEqual(await o.submit(), o)
    assert.strictEqual(o.id, 555)
    assert.strictEqual(o.status, 'ACTIVE')
  })

  test('recreate cancels, clears the id, then resubmits', async () => {
    const order: string[] = []
    const api = fakeApi({
      cancelOrder: async () => { order.push('cancel'); return 'ok' },
      submitOrder: async (p: { order: Order }) => {
        order.push('submit')
        assert.strictEqual(p.order.id, null, 'resubmitted carrying the cancelled id')
        return []
      }
    })
    await new Order({ id: 7, symbol: 'tBTCUSD', amount: 1 }, api).recreate()
    assert.deepStrictEqual(order, ['cancel', 'submit'])
  })
})

describe('Order: rendering and statics', () => {
  test('toString names the market, size and every active modifier', () => {
    const o = new Order({
      id: 1, cid: 2, symbol: 'tBTCUSD', amount: 1, amountOrig: 2,
      type: 'LIMIT', price: 21000, status: 'ACTIVE', affiliateCode: 'aff'
    })
    o.setHidden(true)
    o.setPostOnly(true)
    o.setReduceOnly(true)
    o.setNoVariableRates(true)

    const s = o.toString()
    for (const part of [
      '(id: 1)', '(cid: 2)', 'LIMIT', 'BTC/USD', '(ACTIVE)', '1.00000000',
      '(2.00000000)', '21000', 'hidden', 'post-only', 'reduce-only', 'No VRR',
      '[aff-code: aff]'
    ]) assert.ok(s.includes(part), `toString() omitted ${part}: ${s}`)
  })

  test('a market order renders MARKET instead of a price', () => {
    const s = new Order({ symbol: 'tBTCUSD', amount: 1, type: 'EXCHANGE MARKET', price: 5 }).toString()
    assert.ok(s.includes('@ MARKET'), s)
    assert.ok(!s.includes('5.0000'), s)
  })

  test('every multi-word type and status is reachable under an underscore alias', () => {
    assert.strictEqual(Order.type.EXCHANGE_LIMIT, 'EXCHANGE LIMIT')
    assert.strictEqual(Order.type['EXCHANGE LIMIT'], 'EXCHANGE LIMIT')
    assert.strictEqual(Order.status.PARTIALLY_FILLED, 'PARTIALLY FILLED')
    assert.strictEqual(Order.status.ACTIVE, 'ACTIVE')
  })

  test('unserialize maps a raw row onto named fields', () => {
    const row: unknown[] = []
    row[0] = 1; row[3] = 'tBTCUSD'; row[6] = 1.5; row[13] = 'ACTIVE'; row[23] = 1
    const o = Order.unserialize(row) as Record<string, unknown>
    assert.strictEqual(o.id, 1)
    assert.strictEqual(o.symbol, 'tBTCUSD')
    assert.strictEqual(o.status, 'ACTIVE')
    assert.strictEqual(o.notify, true, 'notify is a boolField and must decode to a boolean')
  })

  test('validate accepts an ordinary ungrouped order', () => {
    // The common shape: no group, no client id, no previous type, no TIF and
    // not placed by another order -- all five null. This failed before the
    // nullable() wrapping, which made validate() useless on real rows.
    const row: unknown[] = []
    row[0] = 1; row[1] = null; row[2] = null; row[3] = 'tBTCUSD'
    row[4] = 1600000000000; row[5] = 1600000000000
    row[6] = 1; row[7] = 1; row[8] = 'LIMIT'; row[9] = null; row[10] = null
    row[12] = 0; row[13] = 'ACTIVE'
    row[16] = 21000; row[17] = 0; row[18] = 0; row[19] = 0
    row[23] = 0; row[24] = 0; row[25] = null
    assert.strictEqual(Order.validate(row), null)
  })

  test('each structurally-optional field accepts null on its own', () => {
    const populated = (): unknown[] => {
      const r: unknown[] = []
      r[0] = 1; r[1] = 5; r[2] = 1600000000000; r[3] = 'tBTCUSD'
      r[4] = 1600000000000; r[5] = 1600000000000
      r[6] = 1; r[7] = 1; r[8] = 'LIMIT'; r[9] = 'LIMIT'; r[10] = 1600000000000
      r[12] = 0; r[13] = 'ACTIVE'
      r[16] = 21000; r[17] = 0; r[18] = 0; r[19] = 0
      r[23] = 0; r[24] = 0; r[25] = 9
      return r
    }
    assert.strictEqual(Order.validate(populated()), null, 'the fully-populated row must validate')

    for (const [name, idx] of [
      ['gid', 1], ['cid', 2], ['typePrev', 9], ['mtsTIF', 10], ['placedId', 25]
    ] as Array<[string, number]>) {
      const row = populated()
      row[idx] = null
      assert.strictEqual(Order.validate(row), null, `${name}: null was rejected`)
    }
  })

  test('a present-but-wrong value is still rejected on a nullable field', () => {
    // nullable() must exempt only null -- not everything. A gid of 'seven' is
    // a malformed row, not an absent group.
    const row: unknown[] = []
    row[0] = 1; row[1] = 'seven'; row[3] = 'tBTCUSD'; row[8] = 'LIMIT'
    assert.ok(Order.validate(row) instanceof Error)
  })

  test('a required field is still required', () => {
    const row: unknown[] = []
    row[0] = 'not a number'; row[3] = 'tBTCUSD'; row[8] = 'LIMIT'
    assert.ok(Order.validate(row) instanceof Error, 'id must stay required')
  })

  test('validate rejects a type the exchange does not offer', () => {
    const row: unknown[] = []
    row[0] = 1; row[3] = 'tBTCUSD'; row[8] = 'NOT A REAL TYPE'
    assert.ok(Order.validate(row) instanceof Error)
  })

  test('toPreview carries the fields the preview endpoint reads', () => {
    const o = new Order({ gid: 1, cid: 2, symbol: 'tBTCUSD', amount: 1, type: 'LIMIT', price: 5 })
    assert.deepStrictEqual(o.toPreview(), {
      gid: 1, cid: 2, symbol: 'tBTCUSD', amount: 1, type: 'LIMIT', price: 5,
      notify: undefined, flags: 0
    })
  })

  test('toPreview includes leverage only when one was set', () => {
    assert.strictEqual(
      new Order({ symbol: 'tBTCUSD', lev: 5 }).toPreview().lev, 5)
    assert.strictEqual(
      Object.hasOwn(new Order({ symbol: 'tBTCUSD' }).toPreview(), 'lev'), false)
  })
})
