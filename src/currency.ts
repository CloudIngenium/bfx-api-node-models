import { numberValidator } from './validators/number.js'
import { stringValidator } from './validators/string.js'
import { currencyValidator } from './validators/currency.js'
import { Model } from './model.js'

const fields = {
id: 0,
  name: 1,
  pool: 2,
  explorer: 3,
  symbol: 4,
  walletFx: 5
}

export class Currency extends Model {
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
        name: stringValidator,
        pool: stringValidator,
        explorer: stringValidator,
        currency: currencyValidator,
        walletFx: stringValidator
      }
    })
  }
}
