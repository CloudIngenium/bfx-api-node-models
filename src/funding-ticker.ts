import { numberValidator } from './validators/number.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { dateValidator } from './validators/date.js'
import { Model } from './model.js'

// Field indices per docs.bitfinex.com/reference/rest-public-tickers (funding
// currency row) — live-verified against a real GET /v2/tickers capture, see
// docs/positional-index-truth-table.md. Fixes two pre-existing bugs: (1)
// bidSize/bidPeriod and askSize/askPeriod were swapped, (2) frr was
// validated as a bool instead of the float rate it actually is (no consumer
// imported this model outside this repo, so these are safe corrections, not
// breaking index/type shifts for real traffic). Also fills the
// frrAmountAvailable/firstTrade gap (indices 14-15 are undocumented reserved
// placeholders).
const fields = {
symbol: 0,
  frr: 1,
  bid: 2,
  bidPeriod: 3,
  bidSize: 4,
  ask: 5,
  askPeriod: 6,
  askSize: 7,
  dailyChange: 8,
  dailyChangePerc: 9,
  lastPrice: 10,
  volume: 11,
  high: 12,
  low: 13,
  frrAmountAvailable: 16,
  firstTrade: 17
}

export class FundingTicker extends Model {
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
        symbol: symbolValidator,
        frr: numberValidator,
        bid: priceValidator,
        bidPeriod: numberValidator,
        bidSize: amountValidator,
        ask: priceValidator,
        askPeriod: numberValidator,
        askSize: amountValidator,
        dailyChange: numberValidator,
        dailyChangePerc: numberValidator,
        lastPrice: priceValidator,
        volume: numberValidator,
        high: priceValidator,
        low: priceValidator,
        frrAmountAvailable: amountValidator,
        firstTrade: dateValidator
      }
    })
  }
}
