import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { Model } from './model.js'

export const TRADING_FIELDS = { id: 0, mts: 1, amount: 2, price: 3 }
export const FUNDING_FIELDS = { id: 0, mts: 1, amount: 2, rate: 3, period: 4 }

/**
 * Funding vs trading is a property of ONE ROW: 5 wide (or an object with a
 * `rate`) is funding, 4 wide is trading. For a collection, look at its first
 * row. Until 2026-10-28 the collection's own length counted too, so a 5-row
 * trading snapshot (an illiquid pair, `limit=5`) decoded with the funding
 * layout: price undefined, the price landing in `rate`.
 */
const isFundingShape = (data: unknown): boolean => {
  const first = Array.isArray(data) && (Array.isArray(data[0]) || (typeof data[0] === 'object' && data[0] !== null))
    ? data[0]
    : data
  if (Array.isArray(first)) return first.length === 5
  const rate = (first as Record<string, unknown> | null)?.rate
  return rate !== undefined && rate !== null
}

export class PublicTrade extends Model {
  id!: number
  mts!: number
  amount!: number
  price!: number
  rate!: number
  period!: number

  constructor (data: unknown = {}) {
    if (typeof data !== 'object' || data === null) throw new Error('unknown data type')
    super({ data, fields: isFundingShape(data) ? FUNDING_FIELDS : TRADING_FIELDS })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields: isFundingShape(data) ? FUNDING_FIELDS : TRADING_FIELDS })
  }

  toString (): string {
    const { id, mts, amount, price } = this
    return [`(${id})`, new Date(mts).toLocaleString(), amount, '@', price].join(' ')
  }

  static validate (data: unknown): Error | null {
    // The same row-width dispatch unserialize() uses, so a 5-wide funding row
    // is checked as funding (rate AND period), not as a trading row. It runs
    // before super.validate; isFundingShape tolerates null/undefined, which
    // then reach the guard that turns them into an Error.
    const funding = isFundingShape(data)
    return super.validate({
      data,
      fields: funding ? FUNDING_FIELDS : TRADING_FIELDS,
      validators: funding
        ? { id: numberValidator, mts: dateValidator, amount: amountValidator, rate: priceValidator, period: numberValidator }
        : { id: numberValidator, mts: dateValidator, amount: amountValidator, price: priceValidator }
    })
  }
}
