import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { Model } from './model.js'

const fields = {
mts: 0,
  open: 1,
  close: 2,
  high: 3,
  low: 4,
  volume: 5
}

export class Candle extends Model {
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
        mts: dateValidator,
        open: numberValidator,
        high: numberValidator,
        low: numberValidator,
        close: numberValidator,
        volume: numberValidator
      }
    })
  }
}
