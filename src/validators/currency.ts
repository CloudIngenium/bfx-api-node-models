/**
 * A Bitfinex currency code: 3-20 uppercase letters or digits, starting with a
 * letter (USD, UST, AVAX, TESTUSD, BTCF0, AUSTRALIA200IXF0).
 *
 * Derived from the live `conf/pub:list:currency` listing (254 codes, 3-16
 * characters, none starting with a digit; recorded in
 * test/recordings/conf-symbol-lists.json). The upper bound leaves headroom
 * over the longest live code without accepting unbounded garbage.
 *
 * This checks FORMAT, not membership. It used to check `data/currencies.js`,
 * a set derived from a frozen 193-pair list, so any currency listed after it
 * (SOL, AVAX, every F0 derivative collateral) was rejected on real rows.
 */
export const CURRENCY_PATTERN = '[A-Z][A-Z0-9]{2,19}'

const CURRENCY_RE = new RegExp(`^${CURRENCY_PATTERN}$`)

export function currencyValidator (v: unknown): string | null {
  return typeof v === 'string' && CURRENCY_RE.test(v)
    ? null
    : 'must be a currency code: 3-20 uppercase letters or digits, starting with a letter'
}
