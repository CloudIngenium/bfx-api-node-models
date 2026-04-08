import { numberValidator } from './validators/number.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { Model } from './model.js'

const fields = {
symbol: 0,
  bid: 1,
  bidSize: 2,
  ask: 3,
  askSize: 4,
  dailyChange: 5,
  dailyChangePerc: 6,
  lastPrice: 7,
  volume: 8,
  high: 9,
  low: 10
}

export class TradingTicker extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields })
  }

  quote (): string { return (this.symbol as string || '').substring(4) }
  base (): string { return (this.symbol as string || '').substring(1, 4) }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields,
      validators: {
        symbol: symbolValidator,
        bid: priceValidator,
        bidSize: amountValidator,
        ask: priceValidator,
        askSize: amountValidator,
        dailyChange: numberValidator,
        dailyChangePerc: numberValidator,
        lastPrice: priceValidator,
        volume: numberValidator,
        high: priceValidator,
        low: priceValidator
      }
    })
  }
}
