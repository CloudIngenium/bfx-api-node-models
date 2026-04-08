import { EventEmitter } from 'node:events'
import { isCollection } from './util/is-collection.js'
import { assignFromCollectionOrInstance } from './util/assign-from-collection-or-instance.js'
import { arrFillEmpty } from './util/arr-fill-empty.js'

export type FieldMap = Record<string, number | (number | string)[] | null>
export type ValidatorMap = Record<string, (v: unknown) => string | null>

function getNestedValue (obj: unknown, path: number[]): unknown {
  let current: unknown = obj
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<number, unknown>)[key]
  }
  return current
}

function setNestedValue (arr: unknown[], path: number[], value: unknown): void {
  let current: unknown[] = arr
  for (let i = 0; i < path.length - 1; i++) {
    if (current[path[i]] === undefined || !Array.isArray(current[path[i]])) {
      current[path[i]] = []
    }
    current = current[path[i]] as unknown[]
  }
  current[path[path.length - 1]] = value
}

interface ModelConstructorParams {
  data?: unknown
  fields?: FieldMap
  boolFields?: string[]
}

export class Model extends EventEmitter {
  emptyFill: unknown = null
  _fields: FieldMap
  _boolFields: string[]
  _collection?: Record<string, unknown>[]
  length?: number;
  [key: string]: unknown

  constructor ({ data, fields = {}, boolFields = [] }: ModelConstructorParams = {}) {
    super()
    this._fields = fields
    this._boolFields = boolFields

    if ((typeof data === 'object' && data !== null) || Array.isArray(data)) {
      assignFromCollectionOrInstance({
        data,
        fields,
        boolFields,
        target: this as never
      })
    }
  }

  serialize (): unknown[] {
    const fieldKeys = Object.keys(this._fields)
    const arr: unknown[] = []

    for (const key of fieldKeys) {
      const i = this._fields[key]

      if (Array.isArray(i)) {
        let value = this[key]
        if (this._boolFields.includes(key)) {
          value = value ? 1 : 0
        }
        setNestedValue(arr, i as number[], value)
        continue
      }

      arr[i as number] = this[key]

      if (this._boolFields.includes(key)) {
        arr[i as number] = (arr[i as number] as boolean) ? 1 : 0
      }
    }

    arrFillEmpty(arr, this.emptyFill)
    return arr
  }

  toJS (): unknown {
    const Ctor = this.constructor as unknown as { unserialize (data: unknown): unknown }
    return Ctor.unserialize(this.serialize())
  }

  static unserialize ({ data, fields, boolFields = [] }: {
    data: unknown
    fields: FieldMap
    boolFields?: string[]
  }): Record<string, unknown> | Record<string, unknown>[] {
    if (isCollection(data)) {
      return (data as unknown[][]).map(m => Model.unserialize({
        data: m,
        boolFields,
        fields
      }) as Record<string, unknown>)
    }

    const fieldKeys = Object.keys(fields)
    const obj: Record<string, unknown> = {}

    for (const key of fieldKeys) {
      if (Array.isArray(fields[key])) {
        obj[key] = getNestedValue(data, fields[key] as number[])

        if (boolFields.includes(key)) {
          obj[key] = obj[key] === 1
        }
        continue
      }

      if (String(fields[key]).length === 0) continue

      if (Array.isArray(data)) {
        obj[key] = (data as unknown[])[fields[key] as number]
      } else {
        obj[key] = (data as Record<string, unknown>)[key]
      }

      if (boolFields.includes(key)) {
        obj[key] = obj[key] === 1
      }
    }

    return obj
  }

  static validate ({ data, fields, boolFields = [], validators }: {
    data: unknown
    fields: FieldMap
    boolFields?: string[]
    validators: ValidatorMap
  }): Error | null {
    if (isCollection(data)) {
      return (data as unknown[][]).map(i => Model.validate({
        data: i,
        fields,
        boolFields,
        validators
      })).find(e => e instanceof Error) || null
    }

    const keys = Object.keys(validators)

    for (const key of keys) {
      const instanceValue = Array.isArray(data)
        ? (data as unknown[])[fields[key] as number]
        : (data as Record<string, unknown>)[key]

      if (typeof validators[key] === 'function') {
        const errMessage = validators[key](instanceValue)

        if (typeof errMessage === 'string') {
          return new Error(`${key}: ${errMessage}`)
        }
      }
    }

    return null
  }
}
