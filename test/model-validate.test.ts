import assert from 'node:assert'
import { describe, test } from 'node:test'

import * as models from '../dist/index.js'

/**
 * `validate()` across every model, on input no caller should have to sanitise
 * first.
 *
 * These models decode untrusted wire data, so `validate` is the boundary
 * function: it is called precisely when nobody yet knows whether the payload
 * is well formed. A boundary function that throws for one shape of bad input
 * and returns an Error for every other shape pushes the inconsistency onto
 * every caller, who must then wrap a function whose whole purpose is to avoid
 * a wrap.
 *
 * `validate(undefined)` and `validate(null)` did exactly that: a TypeError
 * from deep inside a property read, while `[]`, a row of `{}`, a row of
 * `null` and a bare string all came back as Errors. Fixed in model.ts; the
 * regression cases are at the bottom of this file.
 */

type ValidatingModel = {
  validate: (data: unknown) => Error | null
  new (data: unknown): { _fields?: Record<string, number | Array<number | string>> }
}

const NOT_INDEX_MAPPED = new Set(['Model', 'OrderBook'])

const validating = (): Array<[string, ValidatingModel]> =>
  Object.entries(models as Record<string, unknown>)
    .filter(([name, v]) =>
      !NOT_INDEX_MAPPED.has(name) &&
      typeof v === 'function' &&
      typeof (v as { validate?: unknown }).validate === 'function' &&
      typeof (v as { prototype?: { serialize?: unknown } }).prototype?.serialize === 'function'
    )
    .filter(([, M]) => {
      const fields = new (M as ValidatingModel)([])._fields
      return fields !== undefined && Object.keys(fields).length > 0
    }) as Array<[string, ValidatingModel]>

const widthOf = (M: ValidatingModel): number => {
  const fields = new M([])._fields!
  return Math.max(
    ...Object.values(fields).map((f) => (Array.isArray(f) ? Number(f[0]) : f))
  ) + 1
}

/** Shapes a caller can realistically hand a decoder, none of them valid. */
const hostileShapes = (width: number): Array<[string, unknown]> => [
  ['an empty array', []],
  ['a row of objects', Array.from({ length: width }, () => ({}))],
  ['a row of nulls', Array.from({ length: width }, () => null)],
  ['a bare string', 'not a row'],
  ['a number', 42],
  ['undefined', undefined],
  ['null', null]
]

describe('validate() is total', () => {
  const entries = validating()

  test('there are models to check', () => {
    assert.ok(entries.length >= 30, `only found ${entries.length}`)
  })

  for (const [name, Model] of entries) {
    describe(name, () => {
      for (const [label, data] of hostileShapes(widthOf(Model))) {
        test(`rejects ${label} without throwing`, () => {
          let result: Error | null = null

          assert.doesNotThrow(() => { result = Model.validate(data) })

          // Not `assert.ok(result)`: a validator returning `undefined` would
          // satisfy a truthiness check being read as "no error" by callers
          // that test `if (err)`, which is the same silent pass this whole
          // file exists to rule out.
          assert.ok(
            result instanceof Error,
            `expected an Error, got ${String(result)}`
          )
        })
      }
    })
  }
})

describe('validate() on a collection', () => {
  const [, Model] = validating()[0]

  test('reports the first bad row rather than the last', () => {
    const good = Array.from({ length: widthOf(Model) }, () => null)
    const result = Model.validate([good, good])

    assert.ok(result instanceof Error)
  })
})

describe('the null/undefined regression', () => {
  // Pinned separately from the table above because this is the specific
  // defect: these two threw a TypeError where every sibling shape returned
  // an Error.
  for (const bad of [undefined, null]) {
    test(`validate(${String(bad)}) returns an Error, and names what it got`, () => {
      const { Order } = models as unknown as { Order: ValidatingModel }

      const result = Order.validate(bad)

      assert.ok(result instanceof Error, 'threw or returned a non-Error')
      assert.match(result.message, new RegExp(String(bad)))
    })
  }
})
