import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { priceValidator } from './validators/price.js'
import { fundingSymbolValidator } from './validators/funding-symbol.js'
import { Model } from './model.js'

const fields = {
symbol: 0,
  bid: 2,
  bidPeriod: 4,
  ask: 5,
  mtsUpdate: 15
}

export class FundingTickerHist extends Model {
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
        symbol: fundingSymbolValidator,
        bid: priceValidator,
        bidPeriod: numberValidator,
        ask: priceValidator,
        mtsUpdate: dateValidator
      }
    })
  }
}
