import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { stringValidator } from './validators/string.js'
import { boolValidator } from './validators/bool.js'
import { symbolValidator } from './validators/symbol.js'
import { nullable } from './validators/nullable.js'
import { Model } from './model.js'

const boolFields = ['notify', 'hidden', 'renew']
const fields = {
id: 0,
  symbol: 1,
  mtsCreate: 2,
  mtsUpdate: 3,
  amount: 4,
  amountOrig: 5,
  type: 6,
  flags: 9,
  status: 10,
  rate: 14,
  period: 15,
  notify: 16,
  hidden: 17,
  renew: 19,
  rateReal: 20
}

export class FundingOffer extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields, boolFields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields, boolFields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields, boolFields,
      validators: {
        mtsCreate: dateValidator,
        mtsUpdate: dateValidator,
        // mtsOpening, mtsLastPayout and noClose belong to FundingCredit /
        // FundingLoan rows; an offer row has no such slot, so a validator
        // for them failed every array input with "no field index declared".
        amountOrig: amountValidator,
        amount: amountValidator,
        flags: numberValidator,
        rate: numberValidator,
        period: numberValidator,
        // Index 20 is a documented placeholder that live rows send as null.
        rateReal: nullable(numberValidator),
        notify: boolValidator,
        hidden: boolValidator,
        renew: boolValidator,
        status: stringValidator,
        symbol: symbolValidator,
        type: stringValidator,
        id: numberValidator
      }
    })
  }
}
