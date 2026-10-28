/**
 * A wire flag Bitfinex sends as the number 0 or 1 and the model keeps as a
 * number (it is not listed in the model's `boolFields`, so neither
 * `unserialize` nor `validate` decodes it to a boolean).
 */
export function flagValidator (v: unknown): string | null {
  return v === 0 || v === 1 ? null : 'must be 0 or 1'
}
