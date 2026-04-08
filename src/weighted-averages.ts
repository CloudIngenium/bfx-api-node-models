import { numberValidator } from './validators/number.js'
import { Model } from './model.js'

const fields = {
tradeCount: 0,
  sumBuyingSpent: 1,
  sumBuyingAmount: 2,
  sumSellingSpent: 4,
  sumSellingAmount: 5,
  buyingWeightedPrice: 7,
  sellingWeightedPrice: 8,
  firstTradeMts: 10,
  lastTradeMts: 11
}

export class WeightedAverages extends Model {
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
        tradeCount: numberValidator,
        sumBuyingSpent: numberValidator,
        sumBuyingAmount: numberValidator,
        sumSellingSpent: numberValidator,
        sumSellingAmount: numberValidator,
        buyingWeightedPrice: numberValidator,
        sellingWeightedPrice: numberValidator,
        firstTradeMts: numberValidator,
        lastTradeMts: numberValidator
      }
    })
  }
}
