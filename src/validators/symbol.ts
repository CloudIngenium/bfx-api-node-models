import { SYMBOLS } from '../data/symbols.js'

const VALID_SYMBOLS = Object.values(SYMBOLS)

export function symbolValidator (v: unknown): string | null {
  return !VALID_SYMBOLS.includes(v as string)
    ? 'must be a symbol currently traded on Bitfinex'
    : null
}
