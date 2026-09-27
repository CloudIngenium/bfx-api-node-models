import assert from 'node:assert'
import { describe, test } from 'node:test'

import { OrderBook } from '../dist/index.js'

/**
 * The locally maintained order book.
 *
 * It was at 0% function coverage, which is the wrong number for the one model
 * that holds mutable state. Every other model in this package is a decode: an
 * array in, named fields out, no memory. This one accumulates -- each delta is
 * applied to the result of every delta before it -- so a bug here does not
 * produce a visibly wrong row, it produces a book that drifts quietly away
 * from the exchange's and stays wrong until something reconciles it.
 *
 * Downstream, `bitfinex-api-node` compares `checksum()` against the value the
 * exchange sends and reconnects on a mismatch. That guard is only as good as
 * the checksum, and the checksum is only as good as the ordering the mutation
 * maintains -- so ordering is asserted directly here rather than trusted via
 * the checksum that depends on it.
 *
 * A precision entry is [price, count, amount]; a raw (R0) entry is
 * [orderId, price, amount]. Same arity, different meaning, and the two use
 * different delete sentinels -- count 0 against price 0. Both are covered.
 */

/** Distinct prices per side, deliberately inserted out of order. */
const seed = (ob: InstanceType<typeof OrderBook>): void => {
  ob.updateWith([100, 1, 2])
  ob.updateWith([101, 1, 3])
  ob.updateWith([99, 1, 1])
  ob.updateWith([200, 1, -2])
  ob.updateWith([199, 1, -1])
}

describe('OrderBook: which side an entry lands on', () => {
  test('a positive amount is a bid, a negative amount is an ask', () => {
    const ob = new OrderBook()
    seed(ob)

    assert.deepStrictEqual(ob.bids.map((l) => l[0]), [101, 100, 99])
    assert.deepStrictEqual(ob.asks.map((l) => l[0]), [199, 200])
  })

  test('bids descend and asks ascend regardless of insertion order', () => {
    // Inserted 100, 101, 99 and 200, 199. If sorting were insertion order,
    // topBid would be 100 and every price-derived read below would be wrong.
    const ob = new OrderBook()
    seed(ob)

    assert.strictEqual(ob.topBid(), 101)
    assert.strictEqual(ob.topAsk(), 199)
  })
})

describe('OrderBook: mutation', () => {
  test('re-quoting a price replaces the level instead of duplicating it', () => {
    const ob = new OrderBook()
    seed(ob)

    ob.updateWith([100, 2, 7])

    assert.strictEqual(ob.bids.filter((l) => l[0] === 100).length, 1)
    assert.deepStrictEqual(ob.bids.map((l) => l[0]), [101, 100, 99])
    assert.deepStrictEqual(ob.getEntry(100), { price: 100, count: 2, amount: 7 })
  })

  test('count 0 removes the level', () => {
    const ob = new OrderBook()
    seed(ob)

    assert.strictEqual(ob.updateWith([100, 0, 2]), true)
    assert.deepStrictEqual(ob.bids.map((l) => l[0]), [101, 99])
  })

  test('deleting a price that is not there reports false and changes nothing', () => {
    const ob = new OrderBook()
    seed(ob)
    const before = JSON.stringify(ob.bids)

    assert.strictEqual(ob.updateWith([555, 0, 2]), false)
    assert.strictEqual(JSON.stringify(ob.bids), before)
  })

  test('a non-finite entry is refused rather than poisoning the book', () => {
    // NaN in a price would sort unpredictably and make every comparison below
    // it false, so the book must reject the entry outright.
    const ob = new OrderBook()
    seed(ob)
    const before = JSON.stringify(ob.bids)

    assert.strictEqual(ob.updateWith([NaN, 1, 2]), false)
    assert.strictEqual(JSON.stringify(ob.bids), before)
  })

  test('an update is announced', () => {
    const ob = new OrderBook()
    const seen: number[][] = []
    ob.on('update', (entry: number[]) => seen.push(entry))

    ob.updateWith([100, 1, 2])

    assert.deepStrictEqual(seen, [[100, 1, 2]])
  })

  test('a snapshot replaces the book rather than merging into it', () => {
    const ob = new OrderBook()
    seed(ob)

    ob.updateFromSnapshot([[50, 1, 1]])

    assert.deepStrictEqual(ob.bids, [[50, 1, 1]])
    assert.deepStrictEqual(ob.asks, [])
  })
})

describe('OrderBook: raw (R0) books key on order id, not price', () => {
  test('two orders at the same price coexist', () => {
    // The defining difference. In a precision book the second entry would
    // replace the first; in a raw book both are live orders.
    const raw = new OrderBook([], true)

    raw.updateWith([111, 100, 1])
    raw.updateWith([222, 100, 1])

    assert.deepStrictEqual(raw.bids, [[111, 100, 1], [222, 100, 1]])
  })

  test('price 0 is the delete sentinel, and removes only that order', () => {
    const raw = new OrderBook([], true)
    raw.updateWith([111, 100, 1])
    raw.updateWith([222, 100, 1])

    assert.strictEqual(raw.updateWith([111, 0, 1]), true)

    assert.deepStrictEqual(raw.bids, [[222, 100, 1]])
  })

  test('the checksum distinguishes raw from precision', () => {
    // Same three numbers per row, different meaning. A checksum that ignored
    // `raw` would report a mismatch against the exchange on every raw book.
    const rows = [[123456, 100.5, 1.5], [123457, 99.5, -2]]

    assert.notStrictEqual(
      OrderBook.checksumArr(rows, true),
      OrderBook.checksumArr(rows, false)
    )
  })
})

describe('OrderBook: prices derived from the book', () => {
  const populated = (): InstanceType<typeof OrderBook> => {
    const ob = new OrderBook()
    seed(ob)
    return ob
  }

  test('mid is the midpoint of the top of each side', () => {
    assert.strictEqual(populated().midPrice(), 150)
  })

  test('spread is the gap between them', () => {
    assert.strictEqual(populated().spread(), 98)
  })

  test('amounts total each side, asks as a magnitude', () => {
    assert.strictEqual(populated().bidAmount(), 6)
    assert.strictEqual(populated().askAmount(), 3)
  })

  test('an empty book reports 0 and null rather than NaN', () => {
    // NaN would propagate silently through any sizing arithmetic downstream;
    // null and 0 are at least checkable.
    const empty = new OrderBook()

    assert.strictEqual(empty.midPrice(), 0)
    assert.strictEqual(empty.spread(), 0)
    assert.strictEqual(empty.topBid(), null)
    assert.strictEqual(empty.topAsk(), null)
    assert.strictEqual(empty.topBidLevel(), null)
    assert.strictEqual(empty.topAskLevel(), null)
  })

  test('volBPSMid counts only volume inside the band', () => {
    const ob = populated()

    // mid is 150; 1000 bps is +-10%, i.e. 135..165, and every level sits
    // outside it.
    assert.strictEqual(ob.volBPSMid(1000), 0)
    // Widen past the outermost level and the volume appears.
    assert.ok(ob.volBPSMid(10000) > 0)
  })
})

describe('OrderBook: conversion', () => {
  test('a snapshot round-trips through the constructor', () => {
    const snap = [[101, 1, 3], [100, 1, 2], [199, 1, -1], [200, 1, -2]]
    const ob = new OrderBook(snap)

    assert.deepStrictEqual(ob.bids, [[101, 1, 3], [100, 1, 2]])
    assert.deepStrictEqual(ob.asks, [[199, 1, -1], [200, 1, -2]])
    // serialize is asks-then-bids, each side still ordered.
    assert.deepStrictEqual(ob.serialize(), [
      [199, 1, -1], [200, 1, -2], [101, 1, 3], [100, 1, 2]
    ])
  })

  test('the instance checksum matches the static one for the same rows', () => {
    const snap = [[101, 1, 3], [100, 1, 2], [199, 1, -1], [200, 1, -2]]

    assert.strictEqual(
      new OrderBook(snap).checksum(),
      OrderBook.checksumArr(snap, false)
    )
  })

  test('toJS names both sides, empty book or not', () => {
    // The empty case is the regression: `[]` serializes to a single-row read,
    // so toJS() used to return `{}` and `toJS().bids.length` threw at startup
    // and nowhere else.
    assert.deepStrictEqual(new OrderBook().toJS(), { bids: [], asks: [] })

    const populated = new OrderBook([[101, 1, 3], [199, 1, -1]]).toJS() as {
      bids: unknown[], asks: unknown[]
    }
    assert.strictEqual(populated.bids.length, 1)
    assert.strictEqual(populated.asks.length, 1)
  })

  test('unserialize names the fields of a single row', () => {
    assert.deepStrictEqual(
      OrderBook.unserialize([101, 1, 3]),
      { price: 101, count: 1, amount: 3 }
    )
  })

  test('arrayOBMidPrice works without constructing a book', () => {
    // bitfinex-api-node uses the array statics on its managed books rather
    // than instantiating, so they need their own coverage.
    const snap = [[101, 1, 3], [100, 1, 2], [199, 1, -1], [200, 1, -2]]

    assert.strictEqual(OrderBook.arrayOBMidPrice(snap, false), 150)
  })

  test('updateArrayOBWith mutates a bare array the same way', () => {
    const arr: number[][] = [[100, 1, 2]]

    assert.strictEqual(OrderBook.updateArrayOBWith(arr, [101, 1, 3], false), true)

    assert.deepStrictEqual(arr.map((l) => l[0]), [101, 100])
  })
})
