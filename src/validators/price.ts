import { numberValidator } from './number.js'

export function priceValidator (v: unknown): string | null {
  return numberValidator(v) || (v as number) < 0
    ? 'must be a number greater than zero'
    : null
}
