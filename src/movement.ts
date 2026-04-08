import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { stringValidator } from './validators/string.js'
import { currencyValidator } from './validators/currency.js'
import { Model } from './model.js'

const fields = {
id: 0,
  currency: 1,
  currencyName: 2,
  mtsStarted: 5,
  mtsUpdated: 6,
  status: 9,
  amount: 12,
  fees: 13,
  destinationAddress: 16,
  transactionId: 20,
  note: 21
}

export class Movement extends Model {
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
        currency: currencyValidator,
        currencyName: stringValidator,
        mtsStarted: dateValidator,
        mtsUpdated: dateValidator,
        status: stringValidator,
        amount: amountValidator,
        fees: numberValidator,
        destinationAddress: stringValidator,
        transactionId: stringValidator,
        note: stringValidator
      }
    })
  }
}
