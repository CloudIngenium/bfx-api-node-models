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
  /**
   * Derived: whether the symbol supports margin trading. True iff the
   * Bitfinex response included margin info (initialMargin / minimumMargin).
   * Set in the constructor after the base Model assigns parsed fields.
   */
  margin: boolean = false

  constructor (data: unknown = {}) {
    super({ data, fields })
    this.margin = this.initialMargin != null && this.minimumMargin != null
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    const result = super.unserialize({ data, fields })
    // Inject the derived `margin` boolean into the plain-object form too,
    // so consumers using transform: false / unserialize() see it.
    if (Array.isArray(result)) {
      for (const row of result) {
        row.margin = row.initialMargin != null && row.minimumMargin != null
      }
    } else if (result && typeof result === 'object') {
      result.margin = result.initialMargin != null && result.minimumMargin != null
    }
    return result
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
