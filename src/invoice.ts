import { stringValidator } from './validators/string.js'
import { Model } from './model.js'

const fields = {
invoiceHash: 0,
  invoice: 1,
  // PLACEHOLDER
  // PLACEHOLDER
  amount: 4
}

export class Invoice extends Model {
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
        invoiceHash: stringValidator,
        invoice: stringValidator,
        amount: stringValidator
      }
    })
  }
}
