import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
mts: 0,
  type: 1,
  messageID: 2,
  notifyInfo: 4,
  code: 5,
  status: 6,
  text: 7
}

export class Notification extends Model {
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
        mts: dateValidator,
        type: stringValidator,
        messageID: numberValidator,
        code: numberValidator,
        status: stringValidator,
        text: stringValidator
      }
    })
  }
}
