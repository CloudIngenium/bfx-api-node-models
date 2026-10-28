import { currencyValidator } from './currency.js'

/**
 * A funding symbol is `f` followed by a currency code: fUSD, fUST, fTESTUSD.
 *
 * Format only, like `symbolValidator`: every code in the live
 * `conf/pub:list:currency` listing passes as `f` + code
 * (test/recordings/conf-symbol-lists.json). The funding models (offers,
 * loans, credits, trades, tickers, info) validate `symbol` with this, because
 * a trading-symbol check rejects every funding symbol that exists.
 */
export function fundingSymbolValidator (v: unknown): string | null {
  const invalid = 'must be a funding symbol: f + a currency code'

  if (typeof v !== 'string' || v.charAt(0) !== 'f') return invalid

  return currencyValidator(v.slice(1)) === null ? null : invalid
}
