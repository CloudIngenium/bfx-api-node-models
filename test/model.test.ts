import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Model } from '../dist/model.js'
import type { FieldMap, ValidatorMap } from '../dist/model.js'

// `src/model.ts` is the engine every model in this package runs on, so it is
// exercised here directly against tiny local subclasses rather than through a
// real Bitfinex model — a wire-shape fixture would couple these assertions to
// one channel's index layout and hide which engine branch actually ran.

interface TestModelCtor {
  new (data?: unknown): Model
  unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[]
  validate (data: unknown): Error | null
}

function defineModel (
  fields: FieldMap,
  { boolFields = [], validators = {} }: { boolFields?: string[], validators?: ValidatorMap } = {}
): TestModelCtor {
  return class TestModel extends Model {
    constructor (data: unknown = {}) {
      super({ data, fields, boolFields })
    }

    static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
      return super.unserialize({ data, fields, boolFields })
    }

    static validate (data: unknown): Error | null {
      return super.validate({ data, fields, boolFields, validators })
    }
  } as unknown as TestModelCtor
}

const okValidator = (): string | null => null
const numberish = (v: unknown): string | null => typeof v === 'number' ? null : 'must be a number'

// alpha/beta/flag are flat slots; nested/deep are `[a, b]` paths into the
// sub-arrays the pub:info:* endpoints use.
const Widget = defineModel(
  { alpha: 0, beta: 1, flag: 2, nested: [3, 0], deep: [4, 1] },
  { boolFields: ['flag'] }
)

const row = ['A', 2, 1, ['n0', 'n1'], ['d0', 'd1']]

test('Model — unserialize() maps a flat array payload onto field names', () => {
  const result = Widget.unserialize(row) as Record<string, unknown>
  assert.equal(result.alpha, 'A')
  assert.equal(result.beta, 2)
})

test('Model — unserialize() reads an object payload by key, not by index', () => {
  const result = Widget.unserialize({ alpha: 'from-object', beta: 9, flag: 1 }) as Record<string, unknown>
  assert.equal(result.alpha, 'from-object')
  assert.equal(result.beta, 9)
  assert.equal(result.flag, true, 'boolFields coercion applies to the object form too')
})

test('Model — unserialize() maps a collection (array of arrays) row by row', () => {
  const second = ['B', 3, 0, ['x0', 'x1'], ['y0', 'y1']]
  const result = Widget.unserialize([row, second]) as Record<string, unknown>[]
  assert.ok(Array.isArray(result))
  assert.equal(result.length, 2)
  assert.equal(result[0].alpha, 'A')
  assert.equal(result[1].alpha, 'B')
  assert.equal(result[1].flag, false)
})

test('Model — unserialize() resolves nested [a, b] field paths', () => {
  const result = Widget.unserialize(row) as Record<string, unknown>
  assert.equal(result.nested, 'n0')
  assert.equal(result.deep, 'd1')
})

test('Model — unserialize() yields undefined for a nested path that dead-ends', () => {
  // getNestedValue bails out as soon as the current segment is not an object,
  // rather than throwing — a short row must not crash the decoder.
  const short = ['A', 2, 1, null]
  const result = Widget.unserialize(short) as Record<string, unknown>
  assert.equal(result.nested, undefined)
  assert.equal(result.deep, undefined)
})

test('Model — unserialize() coerces a boolField: wire 1 becomes true, anything else false', () => {
  assert.equal((Widget.unserialize(row) as Record<string, unknown>).flag, true)

  const off = [...row]
  off[2] = 0
  assert.equal((Widget.unserialize(off) as Record<string, unknown>).flag, false)

  const absent = [...row]
  absent[2] = null
  assert.equal((Widget.unserialize(absent) as Record<string, unknown>).flag, false)
})

test('Model — unserialize() coerces a nested boolField too', () => {
  const Nested = defineModel({ nestedFlag: [1, 0] }, { boolFields: ['nestedFlag'] })
  assert.equal((Nested.unserialize(['x', [1]]) as Record<string, unknown>).nestedFlag, true)
  assert.equal((Nested.unserialize(['x', [0]]) as Record<string, unknown>).nestedFlag, false)
})

test('Model — unserialize() skips a field whose index is an empty string', () => {
  // Several upstream models declare a placeholder slot as '' to mean "this
  // field exists in the docs but has no index on the wire". It must be left
  // off the result entirely, not decoded as data[''] === undefined.
  const Sparse = defineModel({ kept: 0, placeholder: '' as unknown as number })
  const result = Sparse.unserialize(['value']) as Record<string, unknown>
  assert.equal(result.kept, 'value')
  assert.ok(!('placeholder' in result), 'the empty-index field must be absent, not undefined')
  assert.deepEqual(Object.keys(result), ['kept'])
})

test('Model — constructor assigns decoded fields onto the instance', () => {
  const model = new Widget(row) as unknown as Record<string, unknown>
  assert.equal(model.alpha, 'A')
  assert.equal(model.flag, true)
  assert.equal(model.nested, 'n0')
})

test('Model — constructor ignores a non-object, non-array payload', () => {
  const model = new Widget(42) as unknown as Record<string, unknown>
  assert.equal(model.alpha, undefined)
  assert.equal(model.beta, undefined)
})

test('Model — serialize() writes flat fields back to their declared indices', () => {
  const Flat = defineModel({ alpha: 0, beta: 1 })
  const model = new Flat({ alpha: 'A', beta: 2 })
  assert.deepEqual(model.serialize(), ['A', 2])
})

test('Model — serialize() writes nested paths, creating the missing intermediate array', () => {
  // setNestedValue walks a fresh [] on every serialize, so index 3 does not
  // exist yet when `nested` is written — the intermediate array is created.
  const model = new Widget(row)
  const out = model.serialize()
  assert.ok(Array.isArray(out[3]), 'index 3 must be materialised as an array')
  assert.equal((out[3] as unknown[])[0], 'n0')
  assert.equal((out[4] as unknown[])[1], 'd1')
})

test('Model — serialize() replaces a non-array intermediate with an array', () => {
  // `collide` is declared before `nested`, so slot 1 already holds a scalar by
  // the time the nested path needs it to be an array.
  const Collide = defineModel({ collide: 1, nested: [1, 0] })
  const model = new Collide({ collide: 'scalar-first', nested: 'nested-second' })
  const out = model.serialize()
  assert.ok(Array.isArray(out[1]), 'the scalar must be replaced by an array, not indexed into')
  assert.equal((out[1] as unknown[])[0], 'nested-second')
})

test('Model — serialize() encodes boolFields back to 1/0, flat and nested', () => {
  const Flags = defineModel(
    { flat: 0, nested: [1, 0] },
    { boolFields: ['flat', 'nested'] }
  )

  assert.deepEqual(new Flags({ flat: true, nested: true }).serialize(), [1, [1]])
  assert.deepEqual(new Flags({ flat: false, nested: false }).serialize(), [0, [0]])
})

test('Model — serialize() fills holes with emptyFill (null by default)', () => {
  const Holey = defineModel({ first: 0, last: 3 })
  const model = new Holey({ first: 'a', last: 'z' })
  assert.deepEqual(model.serialize(), ['a', null, null, 'z'])
})

test('Model — serialize() honours a custom emptyFill, including inside nested arrays', () => {
  const Holey = defineModel({ first: 0, nested: [2, 2] })
  const model = new Holey({ first: 'a', nested: 'deep' })
  model.emptyFill = 0
  assert.deepEqual(model.serialize(), ['a', 0, [0, 0, 'deep']])
})

test('Model — toJS() round-trips an instance back through unserialize', () => {
  const model = new Widget(row)
  assert.deepEqual(model.toJS(), Widget.unserialize(model.serialize()))
  assert.equal((model.toJS() as Record<string, unknown>).alpha, 'A')
  assert.equal((model.toJS() as Record<string, unknown>).flag, true)
})

test('Model — validate() returns null when every validator passes on an array', () => {
  const Checked = defineModel(
    { alpha: 0, beta: 1 },
    { validators: { alpha: okValidator, beta: numberish } }
  )
  assert.equal(Checked.validate(['A', 2]), null)
})

test('Model — validate() reads an object payload by key', () => {
  const Checked = defineModel({ beta: 1 }, { validators: { beta: numberish } })
  assert.equal(Checked.validate({ beta: 2 }), null)

  const err = Checked.validate({ beta: 'not-a-number' })
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'beta: must be a number')
})

test('Model — validate() prefixes the failing field name onto the validator message', () => {
  const Checked = defineModel({ beta: 1 }, { validators: { beta: numberish } })
  const err = Checked.validate(['A', 'not-a-number'])
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'beta: must be a number')
})

test('Model — validate() validates a nested [a, b] field path', () => {
  const Checked = defineModel({ nested: [1, 0] }, { validators: { nested: numberish } })
  assert.equal(Checked.validate(['x', [7]]), null)

  const err = Checked.validate(['x', ['seven']])
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'nested: must be a number')
})

test('Model — validate() on a collection returns the first failing row error', () => {
  const Checked = defineModel({ beta: 1 }, { validators: { beta: numberish } })
  assert.equal(Checked.validate([['A', 1], ['B', 2]]), null)

  const err = Checked.validate([['A', 1], ['B', 'bad'], ['C', 3]])
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'beta: must be a number')
})

test('Model — validate() ignores a validator entry that is not a function', () => {
  const Checked = defineModel(
    { alpha: 0 },
    { validators: { alpha: null as unknown as (v: unknown) => string | null } }
  )
  assert.equal(Checked.validate(['anything']), null)
})

test('Model — validate() reports a validator key that is absent from `fields`', () => {
  // Load-bearing guard: without it the validator indexes the payload with
  // `undefined`, so every input fails on a field the caller never sent. It
  // caught two real index typos in this package (mtsUpdated vs mtsUpdate).
  const Typo = defineModel({ alpha: 0 }, { validators: { alphaa: numberish } })
  const err = Typo.validate(['A'])
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'alphaa: no field index declared for this validator')
})

test('Model — the absent-field guard fires before the validator can run', () => {
  let called = false
  const spy = (): string | null => { called = true; return null }
  const Typo = defineModel({ alpha: 0 }, { validators: { ghost: spy } })

  assert.ok(Typo.validate(['A']) instanceof Error)
  assert.equal(called, false, 'a validator with no declared index must never be invoked')
})

test('Model — the absent-field guard also fires for each row of a collection', () => {
  const Typo = defineModel({ alpha: 0 }, { validators: { ghost: numberish } })
  const err = Typo.validate([['A'], ['B']])
  assert.ok(err instanceof Error)
  assert.equal(err.message, 'ghost: no field index declared for this validator')
})

test('Model — a field declared but not validated is left alone', () => {
  const Checked = defineModel(
    { alpha: 0, beta: 1 },
    { validators: { alpha: okValidator } }
  )
  assert.equal(Checked.validate(['A', 'anything at all']), null)
})
