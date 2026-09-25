type Validator = (v: unknown) => string | null

/**
 * Wraps a validator so that `null` and `undefined` pass.
 *
 * Bitfinex uses `null` for "this field has no value yet" (a pair with no
 * executed trades reports FIRST_TRADE as null; a non-margin pair reports
 * null margins) and omits trailing fields entirely on older payloads. Both
 * are valid wire states, so they must not be reported as validation errors —
 * only a present-but-wrong-shaped value is.
 */
export function nullable (validator: Validator): Validator {
  return (v: unknown): string | null => (v == null ? null : validator(v))
}
