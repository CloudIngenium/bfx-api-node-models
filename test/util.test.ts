import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCollection } from '../dist/util/is-collection.js'
import { arrFillEmpty } from '../dist/util/arr-fill-empty.js'
import { assignFromCollectionOrInstance } from '../dist/util/assign-from-collection-or-instance.js'
import { Model } from '../dist/model.js'

// ---------------------------------------------------------------- isCollection

test('isCollection — an array of arrays is a collection', () => {
  assert.equal(isCollection([[1, 2], [3, 4]]), true)
})

test('isCollection — an array of objects is a collection', () => {
  assert.equal(isCollection([{ a: 1 }, { a: 2 }]), true)
})

test('isCollection — a flat array of scalars is a single row, not a collection', () => {
  assert.equal(isCollection(['tBTCUSD', 1, 2]), false)
})

test('isCollection — an empty array is not a collection', () => {
  // The length guard matters: an empty payload must decode as one empty row
  // rather than as a zero-row collection.
  assert.equal(isCollection([]), false)
})

test('isCollection — a leading null is not enough to make a collection', () => {
  assert.equal(isCollection([null, [1]]), false)
})

test('isCollection — non-array input is never a collection', () => {
  assert.equal(isCollection({ a: 1 }), false)
  assert.equal(isCollection('tBTCUSD'), false)
  assert.equal(isCollection(null), false)
  assert.equal(isCollection(undefined), false)
  assert.equal(isCollection(42), false)
})

// ---------------------------------------------------------------- arrFillEmpty

test('arrFillEmpty — fills holes with null by default', () => {
  const arr: unknown[] = []
  arr[0] = 'a'
  arr[3] = 'z'
  arrFillEmpty(arr)
  assert.deepEqual(arr, ['a', null, null, 'z'])
})

test('arrFillEmpty — fills holes with the supplied value', () => {
  const arr: unknown[] = []
  arr[2] = 'z'
  arrFillEmpty(arr, 0)
  assert.deepEqual(arr, [0, 0, 'z'])
})

test('arrFillEmpty — recurses into nested arrays', () => {
  const nested: unknown[] = []
  nested[1] = 'deep'
  const arr: unknown[] = ['a', nested]
  arrFillEmpty(arr)
  assert.deepEqual(arr, ['a', [null, 'deep']])
})

test('arrFillEmpty — leaves falsy-but-present values alone', () => {
  // null, 0 and false are real Bitfinex wire values; only `undefined` is a hole.
  const arr: unknown[] = [null, 0, false, '', NaN]
  arrFillEmpty(arr, 'FILLED')
  assert.deepEqual(arr, [null, 0, false, '', NaN])
})

test('arrFillEmpty — mutates in place and returns nothing', () => {
  const arr: unknown[] = [undefined, 'b']
  assert.equal(arrFillEmpty(arr), undefined)
  assert.deepEqual(arr, [null, 'b'])
})

// ------------------------------------------ assignFromCollectionOrInstance

interface FakeTarget {
  constructor: { unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] }
  _collection?: Record<string, unknown>[]
  length?: number
  [key: string]: unknown
}

/** A stand-in for a Model subclass: just enough shape for the helper to use. */
function fakeTarget (unserialize: (data: unknown) => Record<string, unknown> | Record<string, unknown>[]): FakeTarget {
  return { constructor: { unserialize } } as FakeTarget
}

const decodeRow = (data: unknown): Record<string, unknown> => {
  const arr = data as unknown[]
  return { symbol: arr[0], price: arr[1] }
}

const decode = (data: unknown): Record<string, unknown> | Record<string, unknown>[] =>
  isCollection(data) ? (data as unknown[][]).map(decodeRow) : decodeRow(data)

test('assignFromCollectionOrInstance — copies a plain object payload straight onto the target', () => {
  const target = fakeTarget(() => {
    throw new Error('unserialize must not be called for the object form')
  })

  assignFromCollectionOrInstance({ data: { symbol: 'tBTCUSD', price: 7 }, fields: {}, target: target as never })

  assert.equal(target.symbol, 'tBTCUSD')
  assert.equal(target.price, 7)
  assert.equal(target._collection, undefined)
})

test('assignFromCollectionOrInstance — decodes a single flat row onto the target', () => {
  const target = fakeTarget(decode)
  assignFromCollectionOrInstance({ data: ['tBTCUSD', 7], fields: {}, target: target as never })

  assert.equal(target.symbol, 'tBTCUSD')
  assert.equal(target.price, 7)
  assert.equal(target._collection, undefined, 'a single row must not become a collection')
  assert.equal(target.length, undefined)
})

test('assignFromCollectionOrInstance — unwraps a single-row array-of-arrays', () => {
  // REST endpoints that take `symbols=` return [[row]] even for one symbol;
  // that must decode as ONE instance, not a one-element collection.
  const target = fakeTarget(decode)
  assignFromCollectionOrInstance({ data: [['tBTCUSD', 7]], fields: {}, target: target as never })

  assert.equal(target.symbol, 'tBTCUSD')
  assert.equal(target.price, 7)
  assert.equal(target._collection, undefined)
})

test('assignFromCollectionOrInstance — builds a collection from multiple rows', () => {
  const target = fakeTarget(decode)
  assignFromCollectionOrInstance({
    data: [['tBTCUSD', 7], ['tETHUSD', 3]],
    fields: {},
    target: target as never
  })

  assert.equal(target.length, 2)
  assert.deepEqual(target._collection, [
    { symbol: 'tBTCUSD', price: 7 },
    { symbol: 'tETHUSD', price: 3 }
  ])
  assert.deepEqual(target[0], { symbol: 'tBTCUSD', price: 7 })
  assert.deepEqual(target[1], { symbol: 'tETHUSD', price: 3 })
})

test('assignFromCollectionOrInstance — a collection target is iterable and terminates', () => {
  const target = fakeTarget(decode)
  assignFromCollectionOrInstance({
    data: [['tBTCUSD', 7], ['tETHUSD', 3]],
    fields: {},
    target: target as never
  })

  const seen = [...(target as unknown as Iterable<Record<string, unknown>>)]
  assert.equal(seen.length, 2)
  assert.deepEqual(seen.map(r => r.symbol), ['tBTCUSD', 'tETHUSD'])

  // A second pass must restart from zero — the iterator factory owns its cursor.
  assert.equal([...(target as unknown as Iterable<unknown>)].length, 2)
})

test('assignFromCollectionOrInstance — a single-element array of objects is a collection', () => {
  // data[0] is an object (not an array), so the `length === 1` unwrap does not
  // apply and the object-row branch of the collection check is what fires.
  const target = fakeTarget((data) => (data as Record<string, unknown>[]).map(r => ({ ...r, seen: true })))
  assignFromCollectionOrInstance({ data: [{ symbol: 'tBTCUSD' }], fields: {}, target: target as never })

  assert.equal(target.length, 1)
  assert.deepEqual(target._collection, [{ symbol: 'tBTCUSD', seen: true }])
})

test('assignFromCollectionOrInstance — an empty array assigns nothing', () => {
  const target = fakeTarget(() => {
    throw new Error('unserialize must not be called for an empty payload')
  })

  assignFromCollectionOrInstance({ data: [], fields: {}, target: target as never })

  assert.equal(target._collection, undefined)
  assert.equal(target.length, undefined)
})

test('assignFromCollectionOrInstance — null and primitives assign nothing', () => {
  for (const data of [null, undefined, 42, 'tBTCUSD']) {
    const target = fakeTarget(() => {
      throw new Error(`unserialize must not be called for ${String(data)}`)
    })

    assignFromCollectionOrInstance({ data, fields: {}, target: target as never })
    assert.deepEqual(Object.keys(target), ['constructor'])
  }
})

test('assignFromCollectionOrInstance — boolFields survive the round trip through a real Model', () => {
  // The helper itself ignores boolFields (the subclass unserialize applies
  // them); this asserts the coercion still lands on the instance.
  const fields = { symbol: 0, flag: 1 }
  const boolFields = ['flag']

  class Flagged extends Model {
    constructor (data: unknown = {}) {
      super({ data, fields, boolFields })
    }

    static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
      return super.unserialize({ data, fields, boolFields })
    }
  }

  const on = new Flagged(['tBTCUSD', 1]) as unknown as Record<string, unknown>
  assert.equal(on.flag, true)

  const off = new Flagged(['tBTCUSD', 0]) as unknown as Record<string, unknown>
  assert.equal(off.flag, false)

  const collection = new Flagged([['tBTCUSD', 1], ['tETHUSD', 0]]) as unknown as Record<string, unknown>
  assert.equal(collection.length, 2)
  assert.equal((collection._collection as Record<string, unknown>[])[0].flag, true)
  assert.equal((collection._collection as Record<string, unknown>[])[1].flag, false)
})
