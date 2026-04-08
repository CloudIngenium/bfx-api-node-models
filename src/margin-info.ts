import { numberValidator } from './validators/number.js'
import { amountValidator } from './validators/amount.js'
import { symbolValidator } from './validators/symbol.js'
import { stringValidator } from './validators/string.js'
import { isCollection } from './util/is-collection.js'
import { Model } from './model.js'

export class MarginInfo extends Model {
  type!: string
  symbol!: string
  userPL!: number
  userSwaps!: number
  marginBalance!: number
  marginNet!: number
  tradableBalance!: number
  grossBalance!: number
  buy!: number
  sell!: number

  constructor (data: unknown) {
    super({ data })
  }

  serialize (): unknown[] {
    const { type } = this
    if (type === 'base') {
      const { userPL, userSwaps, marginBalance, marginNet } = this
      return [type, [userPL, userSwaps, marginBalance, marginNet]]
    }
    const { symbol, tradableBalance, grossBalance, buy, sell } = this
    return [type, symbol, [tradableBalance, grossBalance, buy, sell]]
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    if (isCollection(data)) {
      return (data as unknown[][]).map(e => MarginInfo.unserialize(e) as Record<string, unknown>)
    }

    const arr = data as unknown[]
    if (Array.isArray(arr)) {
      if (arr[0] === 'base') {
        const info = arr[1] as number[]
        return { type: 'base', userPL: info[0], userSwaps: info[1], marginBalance: info[2], marginNet: info[3] }
      }
      if (typeof arr[1] === 'string') {
        const info = arr[2] as number[]
        return { type: arr[0] as string, symbol: arr[1], tradableBalance: info[0], grossBalance: info[1], buy: info[2], sell: info[3] }
      }
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>
    }

    return {}
  }

  static validate (data: unknown): Error | null {
    const d = data as Record<string, unknown>
    if (d.type === 'base') {
      return super.validate({
        data, fields: {},
        validators: { type: stringValidator, userPL: amountValidator, userSwaps: amountValidator, marginBalance: amountValidator, marginNet: amountValidator }
      })
    }
    return super.validate({
      data, fields: {},
      validators: { type: stringValidator, symbol: symbolValidator, tradableBalance: amountValidator, grossBalance: amountValidator, buy: numberValidator, sell: numberValidator }
    })
  }
}
