import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { stringValidator } from './validators/string.js'
import { boolValidator } from './validators/bool.js'
import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { currencyValidator } from './validators/currency.js'
import { Model } from './model.js'
import { Order } from './order.js'

const boolFields = ['maker']
const fields = {
id: 0,
  symbol: 1,
  mtsCreate: 2,
  orderID: 3,
  execAmount: 4,
  execPrice: 5,
  orderType: 6,
  orderPrice: 7,
  maker: 8,
  fee: 9,
  feeCurrency: 10
}

export class Trade extends Model {
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
        id: numberValidator,
        symbol: symbolValidator,
        mtsCreate: dateValidator,
        orderID: stringValidator,
        execAmount: amountValidator,
        execPrice: priceValidator,
        orderType: (v: unknown) => stringValidator(v as string, Object.values(Order.type)),
        orderPrice: priceValidator,
        maker: boolValidator,
        fee: numberValidator,
        feeCurrency: currencyValidator
      }
    })
  }
}
