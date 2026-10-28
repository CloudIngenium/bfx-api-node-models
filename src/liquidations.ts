import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { flagValidator } from './validators/flag.js'
import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { nullable } from './validators/nullable.js'
import { Model } from './model.js'

// Field indices per docs.bitfinex.com/reference/rest-public-liquidations (see
// docs/positional-index-truth-table.md). LIQUIDATION_PRICE (index 11) is null
// on some live rows. IS_MATCH / IS_MARKET_SOLD are the wire 0/1 and, with no
// boolFields here, stay numbers.
const fields = {
posId: 1,
  mtsUpdated: 2,
  symbol: 4,
  amount: 5,
  basePrice: 6,
  isMatch: 8,
  isMarketSold: 9,
  liquidationPrice: 11
}

/**
 * GET /liquidations/hist wraps every row one level deeper than other
 * collections: [[["pos", ...]], [["pos", ...]], ...]. Peel that level off so a
 * full response decodes to one object per row instead of one-element arrays.
 * A bare row, or a collection of bare rows, passes through unchanged.
 */
function unwrapRows (data: unknown): unknown {
  if (!Array.isArray(data) || data.length === 0) return data
  const wrapped = data.every((e) => Array.isArray(e) && e.length === 1 && Array.isArray(e[0]))
  return wrapped ? data.map((e) => (e as unknown[])[0]) : data
}

export class Liquidations extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data: unwrapRows(data), fields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data: unwrapRows(data), fields,
      validators: {
        posId: numberValidator,
        mtsUpdated: dateValidator,
        symbol: symbolValidator,
        amount: amountValidator,
        basePrice: priceValidator,
        isMatch: flagValidator,
        isMarketSold: flagValidator,
        liquidationPrice: nullable(priceValidator)
      }
    })
  }
}
