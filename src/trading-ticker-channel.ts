import { numberValidator } from './validators/number.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { dateValidator } from './validators/date.js'
import { nullable } from './validators/nullable.js'
import { Model } from './model.js'

// Field indices per docs.bitfinex.com/reference/ws-public-ticker (trading
// pair channel row) — see docs/positional-index-truth-table.md.
//
// This is the WS `ticker` channel payload — NOT the REST /tickers row
// (`TradingTicker`). The channel message is subscription-scoped so it omits
// SYMBOL, putting every field at index-1 relative to the REST array. The
// counterpart of `FundingTickerChannel`, added so consumers reading a raw
// channel push no longer have to hand-decode it (or mis-apply the
// symbol-prefixed `TradingTicker` map and shift every field by one).
//
// FIRST_TRADE sits at index 10: a live capture of
// `{event:'subscribe',channel:'ticker',symbol:'tBTCUSD'}` on 2026-09-25
// returned an 11-element push ending in 1358182043000.
const fields = {
  bid: 0,
  bidSize: 1,
  ask: 2,
  askSize: 3,
  dailyChange: 4,
  dailyChangePerc: 5,
  lastPrice: 6,
  volume: 7,
  high: 8,
  low: 9,
  firstTrade: 10
}

export class TradingTickerChannel extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data,
      fields,
      validators: {
        bid: priceValidator,
        bidSize: amountValidator,
        ask: priceValidator,
        askSize: amountValidator,
        dailyChange: numberValidator,
        dailyChangePerc: numberValidator,
        lastPrice: priceValidator,
        volume: numberValidator,
        high: priceValidator,
        low: priceValidator,
        firstTrade: nullable(dateValidator)
      }
    })
  }
}
