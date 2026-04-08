import { numberValidator } from './validators/number.js'
import { amountValidator } from './validators/amount.js'
import { symbolValidator } from './validators/symbol.js'
import { isCollection } from './util/is-collection.js'
import { Model } from './model.js'

export class FundingInfo extends Model {
  symbol!: string
  yieldLoan!: number
  yieldLend!: number
  durationLoan!: number
  durationLend!: number

  constructor (data: unknown) {
    super({ data })
  }

  serialize (): unknown[] {
    const { symbol, yieldLoan, yieldLend, durationLoan, durationLend } = this
    return ['sym', symbol, [yieldLoan, yieldLend, durationLoan, durationLend]]
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    if (isCollection(data)) {
      return (data as unknown[][]).map(e => FundingInfo.unserialize(e) as Record<string, unknown>)
    }

    const arr = data as unknown[]
    if (Array.isArray(arr) && arr[0] === 'sym') {
      const info = arr[2] as number[]
      return { symbol: arr[1], yieldLoan: info[0], yieldLend: info[1], durationLoan: info[2], durationLend: info[3] }
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>
    }

    return {}
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields: {},
      validators: {
        symbol: symbolValidator, yieldLoan: amountValidator, yieldLend: amountValidator,
        durationLoan: numberValidator, durationLend: numberValidator
      }
    })
  }
}
