import assert from 'node:assert'
import { describe, test } from 'node:test'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import * as models from '../dist/index.js'

/**
 * Invariants that hold for every model, asserted over every model.
 *
 * This file exists because of what the coverage report was NOT saying. Node's
 * `--experimental-test-coverage` reports only files a test actually loaded, and
 * a module nothing imports does not appear as 0% -- it does not appear at all.
 * 33 of this package's 57 modules were absent, so "100.00 | 100.00 | 100.00"
 * against a 95% gate described 24 files. Order, FundingOffer, FundingCredit,
 * FundingLoan, Candle, LedgerEntry and Movement -- the models the trading bots
 * decode every payload with -- were among the invisible ones.
 *
 * Importing the index is therefore load-bearing, not incidental: it is what
 * makes the number honest. The gate is only as good as its denominator.
 *
 * The invariants here are deliberately structural. A round-trip assertion
 * (`serialize(new M(row)) === row`) was tried first and holds for only 10 of
 * the 38 models, because bool fields, nested paths and emptyFill legitimately
 * transform values. Asserting it anyway would have meant 28 exclusions, and a
 * rule with 28 exceptions tests its exception list.
 */

type Ctor = new (data: unknown) => {
  _fields?: Record<string, number | Array<number | string>>
  serialize: () => unknown[]
  toJS: () => Record<string, unknown>
}

/** `Model` is the abstract base; `OrderBook` is not index-mapped. */
const NOT_INDEX_MAPPED = new Set(['Model', 'OrderBook'])

/**
 * These two carry no `_fields` map: they are parsed by hand from a nested
 * payload rather than by index. They are exercised by their own tests; the
 * structural invariants below simply do not apply.
 */
const NO_FIELD_MAP = new Set(['FundingInfo', 'MarginInfo'])

const modelEntries = (): Array<[string, Ctor]> =>
  Object.entries(models as Record<string, unknown>)
    .filter(([name, v]) =>
      !NOT_INDEX_MAPPED.has(name) &&
      typeof v === 'function' &&
      typeof (v as { prototype?: { serialize?: unknown } }).prototype?.serialize === 'function'
    ) as Array<[string, Ctor]>

/** Outer array width implied by the declared field paths. */
const widthOf = (fields: Record<string, number | Array<number | string>>): number =>
  Math.max(...Object.values(fields).map((f) => (Array.isArray(f) ? Number(f[0]) : f))) + 1

/** A row whose every slot is distinguishable, so a misread lands somewhere visible. */
const rowOf = (width: number): number[] =>
  Array.from({ length: width }, (_, i) => i + 1)

describe('every exported model', () => {
  const entries = modelEntries()

  test('there are models to check at all', () => {
    // Guards against this whole file passing vacuously if the index changes
    // shape -- a suite that silently checks nothing is the failure mode this
    // package already had.
    assert.ok(entries.length >= 35, `only found ${entries.length} models`)
  })

  for (const [name, Model] of entries) {
    const mapped = !NO_FIELD_MAP.has(name)

    describe(name, () => {
      test('constructs from an empty payload', () => {
        assert.doesNotThrow(() => new Model([]))
      })

      if (!mapped) return

      test('declares a field map', () => {
        const fields = new Model([])._fields
        assert.ok(fields && Object.keys(fields).length > 0)
      })

      test('no two fields share a slot', () => {
        // A collision is silent: the later assignment wins and one field reads
        // the other's value forever. Full paths are compared, because nested
        // fields legitimately share an outer index -- SymbolDetails maps
        // firstTrade to [1,0] and initialMargin to [1,8].
        const fields = new Model([])._fields!
        const seen = new Map<string, string>()

        for (const [field, path] of Object.entries(fields)) {
          const key = JSON.stringify(path)
          const prior = seen.get(key)
          assert.strictEqual(
            prior, undefined,
            `${field} and ${prior} both map to ${key}`
          )
          seen.set(key, field)
        }
      })

      test('serialize() returns the declared width', () => {
        const fields = new Model([])._fields!
        const width = widthOf(fields)

        assert.strictEqual(new Model(rowOf(width)).serialize().length, width)
      })

      test('toJS() exposes every declared field', () => {
        const fields = new Model([])._fields!
        const js = new Model(rowOf(widthOf(fields))).toJS()

        for (const field of Object.keys(fields)) {
          assert.ok(field in js, `toJS() omits declared field ${field}`)
        }
      })

      test('unserialize() handles a row and a collection alike', () => {
        const Static = Model as unknown as {
          unserialize?: (data: unknown) => unknown
        }
        if (typeof Static.unserialize !== 'function') return

        const row = rowOf(widthOf(new Model([])._fields!))

        const one = Static.unserialize(row)
        assert.ok(one && typeof one === 'object')

        const many = Static.unserialize([row, row])
        assert.ok(Array.isArray(many), 'a collection must unserialize to an array')
        assert.strictEqual(many.length, 2)
      })
    })
  }
})

describe('the package index', () => {
  test('exports a class for every model module', () => {
    // A model added to src/ but never re-exported is dead code that still
    // passes every test it ships with -- and, before this file, was also
    // invisible to coverage.
    const here = dirname(fileURLToPath(import.meta.url))
    const dist = join(here, '..', 'dist')

    const moduleNames = readdirSync(dist)
      .filter((f) => f.endsWith('.js') && f !== 'index.js')
      .map((f) => f.replace(/\.js$/, ''))

    const exported = new Set(
      Object.keys(models).map((k) => k.toLowerCase())
    )

    const missing = moduleNames.filter((mod) => {
      const camel = mod.replace(/-./g, (s) => s[1].toUpperCase())
      return !exported.has(camel.toLowerCase())
    })

    assert.deepStrictEqual(missing, [], `not re-exported from index: ${missing.join(', ')}`)
  })
})
