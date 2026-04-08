import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { Model } from './model.js'

const fields = {
key: 0,
  type: 1,
  symbol: 2,
  price: 3
}

export class Alert extends Model {
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
        price: priceValidator,
        symbol: symbolValidator
      }
    })
  }
}
