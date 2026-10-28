import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { Liquidations } from '../dist/index.js'

/**
 * Audit 2026-10-28 (models-liquidation-price-09, models-validate-false-reject-06).
 * Upstream reference: bitfinexcom/bfx-api-node-models PR #59 (adds
 * liquidationPrice at index 11).
 *
 * The fixture holds the recorded inner rows; the live /liquidations/hist
 * response wraps each of them one level deeper, so `wire` rebuilds exactly
 * the shape the endpoint served: [[row], [row], ...].
 */
const f = JSON.parse(readFileSync(
  fileURLToPath(new URL('./fixtures/liquidations.json', import.meta.url)), 'utf8'
)) as { rows: Array<[string, unknown[]]> }
const rows = f.rows.map(([, row]) => row)
const wire = rows.map((row) => [row])

describe('Liquidations: liquidationPrice at index 11', () => {
  test('decodes LIQUIDATION_PRICE, including the recorded null', () => {
    const out = Liquidations.unserialize(rows) as Array<Record<string, unknown>>
    assert.deepEqual(out.map((r) => r.liquidationPrice), rows.map((r) => r[11]))
    assert.ok(out.some((r) => r.liquidationPrice === null), 'the fixture must carry a null index 11')
  })
})

describe('Liquidations: the [[row]] REST wrapping', () => {
  test('unserialize() of the live response yields one flat object per row', () => {
    const out = Liquidations.unserialize(wire) as Array<Record<string, unknown>>
    assert.equal(out.length, rows.length)
    out.forEach((r, i) => {
      assert.equal(Array.isArray(r), false)
      assert.equal(r.posId, rows[i][1])
      assert.equal(r.symbol, rows[i][4])
      assert.equal(r.liquidationPrice, rows[i][11])
    })
  })

  test('the constructor exposes the live response as a collection of rows', () => {
    const m = new Liquidations(wire) as unknown as Array<Record<string, unknown>> & { length: number }
    assert.equal(m.length, rows.length)
    assert.equal(m[0].posId, rows[0][1])
    assert.equal(m[0].amount, rows[0][5])
  })

  test('one wrapped element (what bfx-api-node-rest hands the constructor) decodes as one row', () => {
    const m = new Liquidations(wire[2]) as unknown as Record<string, unknown>
    assert.equal(m.posId, rows[2][1])
    assert.equal(m.liquidationPrice, null)
  })

  test('a single-row response [[[row]]] decodes as a one-row collection', () => {
    const out = Liquidations.unserialize([wire[0]]) as Array<Record<string, unknown>>
    assert.equal(out.length, 1)
    assert.equal(out[0].posId, rows[0][1])
  })
})

describe('Liquidations: validate() on the audited fields', () => {
  // The recorded rows are all tDOGEF0:USTF0, which the static data/symbols.ts
  // snapshot does not list (the known symbols-freshness gap in
  // docs/positional-index-truth-table.md). Swapping ONLY the symbol isolates
  // the fields this audit item is about; every other value is recorded.
  const listed = (row: unknown[]): unknown[] => { const r = [...row]; r[4] = 'tBTCUSD'; return r }

  test('with a listed symbol every recorded row validates, wrapped or not (0/1 flags, null liquidationPrice)', () => {
    assert.equal(Liquidations.validate(rows.map(listed)), null)
    assert.equal(Liquidations.validate(rows.map((r) => [listed(r)])), null)
  })

  test('unmodified recorded rows still fail, on symbol only (known symbols-freshness gap)', () => {
    for (const row of rows) {
      assert.match(String(Liquidations.validate(row)), /^Error: symbol:/)
    }
  })

  test('a mixed collection of wrapped and bare rows decodes every row', () => {
    const out = Liquidations.unserialize([wire[0], rows[1]]) as Array<Record<string, unknown>>
    assert.equal(out[0].posId, rows[0][1])
    assert.equal(out[1].posId, rows[1][1])
  })

  test('isMatch / isMarketSold outside 0/1 are rejected', () => {
    const bad = listed(rows[0]); bad[8] = 2
    assert.match(String(Liquidations.validate(bad)), /^Error: isMatch:/)
    const bad2 = listed(rows[0]); bad2[9] = true
    assert.match(String(Liquidations.validate(bad2)), /^Error: isMarketSold:/)
  })

  test('a negative liquidationPrice is rejected', () => {
    const bad = listed(rows[0]); bad[11] = -1
    assert.match(String(Liquidations.validate(bad)), /^Error: liquidationPrice:/)
  })
})
