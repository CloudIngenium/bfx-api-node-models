import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
key: 0,
  value: 1
}

export class CoreSettings extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields,
      validators: {
        key: stringValidator
      }
    })
  }
}
