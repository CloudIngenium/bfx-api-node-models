import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { flagValidator } from './validators/flag.js'
import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { Model } from './model.js'

const fields = {
id: 0,
  symbol: 1,
  mtsCreate: 2,
  offerID: 3,
  amount: 4,
  rate: 5,
  period: 6,
  maker: 7
}

export class FundingTrade extends Model {
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
        symbol: symbolValidator,
        mtsCreate: dateValidator,
        offerID: numberValidator,
        amount: amountValidator,
        rate: priceValidator,
        period: numberValidator,
        // MAKER is the wire 0/1 and, with no boolFields here, stays a number.
        maker: flagValidator
      }
    })
  }
}
