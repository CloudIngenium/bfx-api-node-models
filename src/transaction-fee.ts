import { numberValidator } from './validators/number.js'
import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
symbol: 0,
  fee: [1, 1]
}

export class TransactionFee extends Model {
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
        symbol: stringValidator,
        fee: numberValidator
      }
    })
  }
}
