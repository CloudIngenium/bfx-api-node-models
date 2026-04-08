import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { Model } from './model.js'

export const TRADING_FIELDS = { id: 0, mts: 1, amount: 2, price: 3 }
export const FUNDING_FIELDS = { id: 0, mts: 1, amount: 2, rate: 3, period: 4 }

export class PublicTrade extends Model {
  id!: number
  mts!: number
  amount!: number
  price!: number
  rate!: number
  period!: number

  constructor (data: unknown = {}) {
    if (Array.isArray(data)) {
      if (data.length === 5) super({ data, fields: FUNDING_FIELDS })
      else super({ data, fields: TRADING_FIELDS })
    } else if (typeof data === 'object' && data !== null) {
      if ((data as Record<string, unknown>).rate) super({ data, fields: FUNDING_FIELDS })
      else super({ data, fields: TRADING_FIELDS })
    } else {
      throw new Error('unknown data type')
    }
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    const d = data as unknown[]
    if ((Array.isArray(d[0]) && (d[0] as unknown[]).length === 5) ||
        (typeof d[0] === 'object' && d[0] !== null && (d[0] as Record<string, unknown>).rate) ||
        d.length === 5) {
      return super.unserialize({ data, fields: FUNDING_FIELDS })
    }
    return super.unserialize({ data, fields: TRADING_FIELDS })
  }

  toString (): string {
    const { id, mts, amount, price } = this
    return [`(${id})`, new Date(mts).toLocaleString(), amount, '@', price].join(' ')
  }

  static validate (data: unknown): Error | null {
    const rate = (data as Record<string, unknown>).rate
    return super.validate({
      data,
      fields: Number.isFinite(rate) ? FUNDING_FIELDS : TRADING_FIELDS,
      validators: Number.isFinite(rate)
        ? { id: numberValidator, mts: dateValidator, amount: amountValidator, rate: priceValidator, period: numberValidator }
        : { id: numberValidator, mts: dateValidator, amount: amountValidator, price: priceValidator }
    })
  }
}
