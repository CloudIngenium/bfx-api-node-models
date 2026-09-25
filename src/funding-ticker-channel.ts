import { numberValidator } from './validators/number.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { dateValidator } from './validators/date.js'
import { nullable } from './validators/nullable.js'
import { Model } from './model.js'

// Field indices per docs.bitfinex.com/reference/ws-public-ticker (funding
// currency channel row) — see docs/positional-index-truth-table.md.
//
// This is the WS `fticker` channel payload — NOT the REST /tickers row
// (`FundingTicker`). The channel message is subscription-scoped so it omits
// SYMBOL, so every field sits at index-1 relative to the REST array. This is
// the funding-channel model gap named in the design doc — LendingBot's
// WebSocketManager._process_funding_ticker() hand-decodes this exact shape
// (data[0..9]) today, missing volume/high/low/frrAmountAvailable.
//
// FIRST_TRADE (index 16) reaches this channel too: a live capture of
// `{event:'subscribe',channel:'ticker',symbol:'fUSD'}` on 2026-09-25 returned
// a 17-element push ending in 1469734163000. An earlier revision of this file
// asserted the field was REST-only; that was wrong.
const fields = {
  frr: 0,
  bid: 1,
  bidPeriod: 2,
  bidSize: 3,
  ask: 4,
  askPeriod: 5,
  askSize: 6,
  dailyChange: 7,
  dailyChangePerc: 8,
  lastPrice: 9,
  volume: 10,
  high: 11,
  low: 12,
  frrAmountAvailable: 15,
  firstTrade: 16
}

export class FundingTickerChannel extends Model {
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
        firstTrade: nullable(dateValidator)
      }
    })
  }
}
