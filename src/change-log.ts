import { dateValidator } from './validators/date.js'
import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
mtsCreate: 0,
  log: 2,
  ip: 5,
  userAgent: 6
}

export class ChangeLog extends Model {
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
        mtsCreate: dateValidator,
        log: stringValidator,
        ip: stringValidator,
        userAgent: stringValidator
      }
    })
  }
}
