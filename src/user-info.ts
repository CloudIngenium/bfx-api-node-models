import { numberValidator } from './validators/number.js'
import { stringValidator } from './validators/string.js'
import { boolValidator } from './validators/bool.js'
import { Model } from './model.js'

const boolFields = ['isPaperTradeEnabled', 'isUserMerchant']
const fields = {
id: 0,
  email: 1,
  username: 2,
  timezone: 7,
  isPaperTradeEnabled: 21,
  isUserMerchant: 22
}

export class UserInfo extends Model {
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
        email: stringValidator,
        username: stringValidator,
        timezone: stringValidator,
        isPaperTradeEnabled: boolValidator,
        isUserMerchant: boolValidator
      }
    })
  }
}
