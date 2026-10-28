import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { OrderBook } from '../dist/index.js'

/**
 * The order book against the exchange's own checksums.
 *
 * test/order-book.test.ts asserts the mutation rules on hand-built rows. This
 * file asserts the one property a consumer actually relies on: replaying what
 * Bitfinex sent yields the checksum Bitfinex sent. bitfinex-api-node compares
 * the two and resubscribes on a mismatch, so a checksum that disagrees with
 * the server on a healthy book is a reconnect loop, and one that agrees with
 * a drifted book hides the drift.
 *
 * The fixture is a recorded public WebSocket session (see its `_meta`): book
 * P0 len 25 with the OB_CHECKSUM conf flag, every frame kept in arrival order.
 * Nothing in it is synthetic, so a pass means the code matches the server,
 * not a model of the server. It lives in test/recordings/, not
 * test/fixtures/: wire-contract.test.ts binds every fixture there to a
 * model's `_fields` index map, and OrderBook has none. This recording carries
 * its own oracle instead, the server's checksum frames.
 */

type Row = number[]
type Frame = [Row[] | Row] | ['cs', number]
interface Channel { symbol: string, recording: string, frames: Frame[] }

const fixture = JSON.parse(readFileSync(
  fileURLToPath(new URL('./recordings/order-book-checksum.json', import.meta.url)), 'utf8'
)) as { channels: Channel[] }

const trading = fixture.channels.filter((c) => c.symbol.startsWith('t'))
const funding = fixture.channels.filter((c) => c.symbol.startsWith('f'))
const label = (c: Channel): string => `${c.symbol} (${c.recording})`

interface Replayed { checksums: number, instanceHits: number, arrayHits: number }

/**
 * Feeds one channel through both book APIs: the instance (`updateWith`) and
 * the bare-array statics bitfinex-api-node uses (`updateArrayOBWith`), then
 * scores each against every server checksum frame. `onFrame` sees the books
 * after each delta.
 */
function replay (
  channel: Channel,
  onFrame?: (row: Row, ob: InstanceType<typeof OrderBook>, arr: Row[]) => void
): Replayed {
  let ob = new OrderBook()
  let arr: Row[] = []
  const out = { checksums: 0, instanceHits: 0, arrayHits: 0 }

  for (const frame of channel.frames) {
    if (frame[0] === 'cs') {
      out.checksums++
      if (ob.checksum() === frame[1]) out.instanceHits++
      if (OrderBook.checksumArr(arr) === frame[1]) out.arrayHits++
      continue
    }
    const payload = frame[0]
    if (Array.isArray(payload[0])) {
      ob = new OrderBook(payload as Row[])
      arr = (payload as Row[]).slice()
    } else {
      ob.updateWith(payload as Row)
      OrderBook.updateArrayOBWith(arr, payload as Row)
      onFrame?.(payload as Row, ob, arr)
    }
  }
  return out
}

describe('OrderBook: trading books reproduce the server checksum', () => {
  test('the fixture exercises a price below 1e-6 inside the checksummed top 25', () => {
    // The regression: a toFixed rewrite turned 9.7e-7 into "0.00000097" and
    // 1e-7 into "0.00000010", while the server joins JS string form. Without
    // such a level in the top 25 the replay below would pass vacuously.
    const doge = trading.find((c) => c.symbol === 'tDOGE:BTC')
    assert.ok(doge, 'fixture lost its tDOGE:BTC channel')
    const snap = doge.frames[0][0] as Row[]
    assert.ok(snap.slice(0, 25).some((r) => r[0] < 1e-6 && String(r[0]).includes('e')))
  })

  for (const channel of trading) {
    test(`${label(channel)}: every checksum matches, instance and array`, () => {
      const r = replay(channel)
      assert.ok(r.checksums > 0)
      assert.deepEqual(r, { checksums: r.checksums, instanceHits: r.checksums, arrayHits: r.checksums })
    })
  }
})

describe('OrderBook: aggregated funding books', () => {
  test('the fixture updates a rate that another period also holds', () => {
    // A P0 funding level is (rate, period). Keyed on rate alone, an update or
    // delete of one period overwrites or removes a sibling at the same rate.
    // Without such an update the keying assertions below prove nothing.
    let shared = 0
    for (const channel of funding) {
      replay(channel, (row, ob) => {
        const side = row[3] < 0 ? ob.bids : ob.asks
        if (side.some((l) => l[0] === row[0] && l[1] !== row[1])) shared++
      })
    }
    assert.ok(shared > 10, `only ${shared} shared-rate updates`)
  })

  for (const channel of funding) {
    test(`${label(channel)}: levels stay keyed on (rate, period)`, () => {
      // Order-free oracle: the set of live levels per side, kept by a plain
      // map. Rate-only keying loses levels here regardless of ordering.
      const want = new Map<string, Row>()
      const key = (r: Row): string => `${r[3] < 0 ? 'bid' : 'ask'}|${r[0]}|${r[1]}`
      const sorted = (rows: Row[]): string[] => rows.map((r) => `${key(r)}|${r[2]}|${r[3]}`).sort()
      const snap = channel.frames[0][0] as Row[]
      for (const r of snap) want.set(key(r), r)

      replay(channel, (row, ob, arr) => {
        if (row[2] === 0) want.delete(key(row))
        else want.set(key(row), row)
        const expected = sorted([...want.values()])
        assert.deepEqual(sorted([...ob.bids, ...ob.asks]), expected)
        assert.deepEqual(sorted(arr), expected)
      })
    })

    test(`${label(channel)}: every checksum matches, instance and array`, () => {
      // Two rules make this hold, both established on these recordings only:
      // the rate is joined unrounded (preparePrice cut 2.1917808219178083e-8
      // to 5 significant digits), and levels sharing a rate keep the server's
      // order -- snapshot order, an update in place, a new period after its
      // siblings. See OrderBook#checksum.
      const r = replay(channel)
      assert.ok(r.checksums > 0)
      assert.deepEqual(r, { checksums: r.checksums, instanceHits: r.checksums, arrayHits: r.checksums })
    })
  }
})

describe('OrderBook: raw funding books', () => {
  test('a raw (R0) funding row keys on the offer id, not on (rate, period)', () => {
    // R0 rows are [OFFER_ID, PERIOD, RATE, AMOUNT]: four wide like P0, so the
    // keying must branch on `raw` before the row width.
    const ob = new OrderBook([], true)
    ob.updateWith([1001, 2, 0.0001, 50])
    ob.updateWith([1002, 2, 0.0001, 70])
    assert.equal(ob.asks.length, 2)

    ob.updateWith([1001, 2, 0, 50])
    assert.deepEqual(ob.asks, [[1002, 2, 0.0001, 70]])

    const arr: Row[] = [[1001, 2, 0.0001, 50], [1002, 2, 0.0001, 70]]
    OrderBook.updateArrayOBWith(arr, [1002, 2, 0, 70], true)
    assert.deepEqual(arr, [[1001, 2, 0.0001, 50]])
  })
})
