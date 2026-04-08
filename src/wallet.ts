import { amountValidator } from './validators/amount.js'
import { stringValidator } from './validators/string.js'
import { currencyValidator } from './validators/currency.js'
import { WALLET_TYPES } from './data/wallet-types.js'
import { Model } from './model.js'

const VALID_TYPES = [...WALLET_TYPES]
const fields = {
type: 0,
  currency: 1,
  balance: 2,
  unsettledInterest: 3,
  balanceAvailable: 4,
  description: 5,
  meta: 6
}

export class Wallet extends Model {
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
        type: (v: unknown) => stringValidator(v as string, VALID_TYPES),
        currency: currencyValidator,
        balance: amountValidator,
        unsettledInterest: amountValidator,
        balanceAvailable: amountValidator,
        description: stringValidator
      }
    })
  }
}
