import { stringValidator } from './validators/string.js'
import { boolValidator } from './validators/bool.js'
import { Model } from './model.js'

const boolFields = ['read', 'write']
const fields = {
key: 0,
  read: 1,
  write: 2
}

export class AuthPermission extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields, boolFields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields, boolFields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields, boolFields,
      validators: {
        key: stringValidator,
        read: boolValidator,
        write: boolValidator
      }
    })
  }
}
