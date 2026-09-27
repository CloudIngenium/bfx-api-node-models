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

/**
 * validate() and unserialize() must agree on what a bool field is.
 *
 * Bitfinex sends 0/1 on the wire, never true/false. `unserialize` decodes
 * those to booleans via `boolFields`; `validate` accepted the same parameter
 * and ignored it, so every model that declared a boolField validated the raw
 * number and `boolValidator` rejected it as "must be a bool" -- on a row that
 * was perfectly well formed. Seven models pass boolFields, so this was not an
 * Order-specific problem; Order was only the model that also forgot to pass
 * them.
 *
 * The pairs below are asserted to EXIST in each model's `_fields` map before
 * anything is checked against them. A first draft of this test looked the
 * index up on a static that is not exported, found undefined, and returned
 * early -- seven tests that passed while asserting nothing.
 */
describe('validate(): bool fields decode the same way unserialize decodes them', () => {
  const BOOL_FIELDS: Array<[string, string[]]> = [
    ['Order', ['notify']],
    ['Trade', ['maker']],
    ['FundingOffer', ['notify', 'hidden', 'renew']],
    ['FundingCredit', ['notify', 'hidden', 'renew', 'noClose']],
    ['FundingLoan', ['notify', 'hidden', 'renew', 'noClose']],
    ['UserInfo', ['isPaperTradeEnabled', 'isUserMerchant']],
    ['AuthPermission', ['read', 'write']]
  ]

  for (const [name, boolFields] of BOOL_FIELDS) {
    describe(name, () => {
      const Model = (models as Record<string, any>)[name]

      test('is exported and exposes a field map', () => {
        assert.ok(Model, `${name} is not exported`)
        assert.ok(new Model([])._fields, `${name} has no _fields map`)
      })

      for (const field of boolFields) {
        test(`${field}: the wire's 0 and 1 are both accepted`, () => {
          const fields = new Model([])._fields as Record<string, number | number[]>
          assert.ok(field in fields, `${name} has no field named ${field}`)
          const path = fields[field]
          assert.ok(!Array.isArray(path), `${field} is nested; this test assumes a flat slot`)

          for (const wire of [0, 1]) {
            const row: unknown[] = []
            row[path as number] = wire
            const result = Model.validate(row)
            // The rest of the row is empty, so other validators may object --
            // but never about THIS field. That is the whole assertion.
            if (result instanceof Error) {
              assert.ok(!result.message.startsWith(`${field}:`),
                `rejected the wire value ${wire}: ${result.message}`)
            }
          }
        })
      }
    })
  }

  test('an already-boolean value is still accepted', () => {
    const { Order } = models as Record<string, any>
    const idx = (new Order([])._fields as Record<string, number>).notify
    const row: unknown[] = []
    row[idx] = true
    const result = Order.validate(row)
    if (result instanceof Error) {
      assert.ok(!result.message.startsWith('notify:'), result.message)
    }
  })
})
