import { stringValidator } from './validators/string.js'
import { priceValidator } from './validators/price.js'
import { Model } from './model.js'

const fields = {
key: 0,
  timestamp: 1,
  price: 3,
  priceSpot: 4,
  fundBal: 6,
  fundingAccrued: 9,
  fundingStep: 10,
  clampMin: 22,
  clampMax: 23
}

export class StatusMessagesDeriv extends Model {
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
        key: stringValidator,
        timestamp: stringValidator,
        price: priceValidator,
        priceSpot: priceValidator,
        fundBal: priceValidator,
        fundingAccrued: priceValidator,
        fundingStep: priceValidator,
        clampMin: priceValidator,
        clampMax: priceValidator
      }
    })
  }
}
