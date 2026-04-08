import { amountValidator } from './validators/amount.js'
import { Model } from './model.js'

const fields = {
amount: 0,
  amountNet: 1
}

export class BalanceInfo extends Model {
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
        amount: amountValidator,
        amountNet: amountValidator
      }
    })
  }
}
