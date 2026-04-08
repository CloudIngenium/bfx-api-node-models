import { numberValidator } from './number.js'

export function amountValidator (v: unknown): string | null {
  return numberValidator(v)
}
