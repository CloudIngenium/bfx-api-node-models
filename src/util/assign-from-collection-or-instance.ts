interface AssignTarget {
  constructor: { unserialize (data: unknown): Record<string, unknown>[] | Record<string, unknown> }
  _collection?: Record<string, unknown>[]
  length?: number
  [Symbol.iterator]?: () => Iterator<unknown>
  [key: string]: unknown
}

interface AssignParams {
  data: unknown
  fields: Record<string, unknown>
  boolFields?: string[]
  target: AssignTarget
}

export function assignFromCollectionOrInstance ({ data, fields, boolFields, target }: AssignParams): void {
  if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
    Object.assign(target, data)
  } else if (Array.isArray(data) && data.length > 0) {
    let toParse: unknown = data

    if (Array.isArray(data[0]) && data.length === 1) {
      toParse = data[0]
    }

    const tp = toParse as unknown[]
    if (Array.isArray(tp[0]) || (typeof tp[0] === 'object' && tp[0] !== null)) {
      const collection = target.constructor.unserialize(toParse) as Record<string, unknown>[]
      target._collection = collection

      Object.assign(target, collection)
      target.length = collection.length

      target[Symbol.iterator] = function () {
        let _i = -1
        return {
          next () {
            _i++
            return _i === collection.length
              ? { done: true as const, value: undefined }
              : { value: collection[_i], done: false as const }
          }
        }
      }
    } else {
      Object.assign(target, target.constructor.unserialize(toParse))
    }
  }
}
