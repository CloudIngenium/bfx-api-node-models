import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { PublicTrade } from '../dist/index.js'

const load = (name: string): { payload: number[][] } => {
  const f = JSON.parse(readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), 'utf8'
  )) as { rows: Array<[string, number[]]> }
  return { payload: f.rows.map(([, row]) => row) }
}
const fixture = { trading5: load('public-trades-trading'), funding5: load('public-trades-funding') }

/**
 * models-publictrade-5rows-04 / node-trades-5-20: the funding/trading dispatch
 * tested the COLLECTION length, so a recorded 5-row trading snapshot decoded
 * as funding (price undefined, the price landing in `rate`).
 */
describe('PublicTrade: dispatch on the row width, never the collection length', () => {
  test('a recorded 5-row trading collection keeps price', () => {
    const rows = PublicTrade.unserialize(fixture.trading5.payload) as Array<Record<string, unknown>>
    assert.equal(rows.length, 5)
    rows.forEach((r, i) => {
      assert.equal(r.price, fixture.trading5.payload[i][3])
      assert.equal(r.rate, undefined)
    })
  })

  test('a recorded 5-row funding collection keeps rate and period', () => {
    const rows = PublicTrade.unserialize(fixture.funding5.payload) as Array<Record<string, unknown>>
    rows.forEach((r, i) => {
      assert.equal(r.rate, fixture.funding5.payload[i][3])
      assert.equal(r.period, fixture.funding5.payload[i][4])
    })
  })

  test('the bitfinex-api-node ws2 sequence (unserialize, then new PublicTrade) keeps price', () => {
    // ws2.ts _handleTradeMessage: PublicTrade.unserialize(data) then new PublicTrade(data).
    const t = new PublicTrade(PublicTrade.unserialize(fixture.trading5.payload)) as unknown as Record<string, unknown>
    const first = (t._collection as Array<Record<string, unknown>>)[0]
    assert.equal(first.price, fixture.trading5.payload[0][3])
    assert.equal(first.rate, undefined)
  })

  test('the same sequence on funding rows keeps rate', () => {
    const t = new PublicTrade(PublicTrade.unserialize(fixture.funding5.payload)) as unknown as Record<string, unknown>
    const first = (t._collection as Array<Record<string, unknown>>)[0]
    assert.equal(first.rate, fixture.funding5.payload[0][3])
  })

  test('a raw 5-row trading collection passed to the constructor keeps price', () => {
    const t = new PublicTrade(fixture.trading5.payload) as unknown as Record<string, unknown>
    const first = (t._collection as Array<Record<string, unknown>>)[0]
    assert.equal(first.price, fixture.trading5.payload[0][3])
  })

  test('single rows still dispatch on their own width', () => {
    assert.equal((PublicTrade.unserialize(fixture.trading5.payload[0]) as Record<string, unknown>).price, 80938)
    assert.equal((PublicTrade.unserialize(fixture.funding5.payload[0]) as Record<string, unknown>).period, 2)
    assert.equal(new PublicTrade(fixture.trading5.payload[0]).price, 80938)
    assert.equal(new PublicTrade(fixture.funding5.payload[0]).rate, 0.00012516)
  })
})
