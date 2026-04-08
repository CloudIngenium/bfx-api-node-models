import { numberValidator } from './validators/number.js'
import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
pair: 0,
  initialMargin: [1, 8],
  minimumMargin: [1, 9],
  maximumOrderSize: [1, 4],
  minimumOrderSize: [1, 3]
}

export class SymbolDetails extends Model {
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
        pair: stringValidator,
        initialMargin: numberValidator,
        minimumMargin: numberValidator,
        maximumOrderSize: stringValidator,
        minimumOrderSize: stringValidator
      }
    })
  }
}
