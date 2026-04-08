import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
id: 0,
  time: 2,
  ip: 4,
  extraData: 7
}

export class Login extends Model {
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
        id: numberValidator,
        time: dateValidator,
        ip: stringValidator
      }
    })
  }
}
