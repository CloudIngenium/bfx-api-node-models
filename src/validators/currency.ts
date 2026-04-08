import { CURRENCIES } from '../data/currencies.js'

const VALID_CURRENCIES = Object.values(CURRENCIES)

export function currencyValidator (v: unknown): string | null {
  return !VALID_CURRENCIES.includes(v as string)
    ? 'must be a currency currently tradable on Bitfinex'
    : null
}
