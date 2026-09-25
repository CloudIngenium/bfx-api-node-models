import { stringValidator } from './validators/string.js'
import { nullable } from './validators/nullable.js'
import { Model } from './model.js'

const fields = {
id: 0,
  name: 1,
  pool: 2,
  explorer: 3,
  symbol: 4,
  walletFx: 5
}

export class Currency extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields,
      // Shapes live-verified 2026-09-25 against the six `pub:list:currency` /
      // `pub:map:currency:*` blocks that RESTv2.currencies() stitches together.
      // Only `id` is present for every currency; the mapped blocks cover a
      // subset (83-156 of 254 entries), so the rest are nullable. `explorer`
      // and `walletFx` are arrays, not strings — asserting stringValidator on
      // them, as this map used to, failed on every real row.
      validators: {
        id: stringValidator,
        name: nullable(stringValidator),
        pool: nullable(stringValidator),
        symbol: nullable(stringValidator)
      }
    })
  }
}
