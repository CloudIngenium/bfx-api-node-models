import { numberValidator } from './validators/number.js'
import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
trade_vol_30d: [5, 0],
  fees_trading_30d: [5, 1],
  fees_trading_total_30d: [5, 2],
  fees_funding_30d: [6, 1],
  fees_funding_total_30d: [6, 2],
  makerFee: [4, 0, 0],
  derivMakerRebate: [4, 0, 5],
  takerFeeToCrypto: [4, 1, 0],
  takerFeeToStable: [4, 1, 1],
  takerFeeToFiat: [4, 1, 2],
  derivTakerFee: [4, 1, 5],
  leoLev: [9, 'leo_lev'],
  leoAmountAvg: [9, 'leo_amount_avg']
}

export class AccountSummary extends Model {
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
        trade_vol_30d: stringValidator,
        fees_trading_30d: stringValidator,
        fees_trading_total_30d: numberValidator,
        fees_funding_30d: stringValidator,
        fees_funding_total_30d: numberValidator,
        makerFee: numberValidator,
        derivMakerRebate: numberValidator,
        takerFeeToCrypto: numberValidator,
        takerFeeToStable: numberValidator,
        takerFeeToFiat: numberValidator,
        derivTakerFee: numberValidator,
        leoLev: numberValidator,
        leoAmountAvg: numberValidator
      }
    })
  }
}
