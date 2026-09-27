import { currencyValidator } from './currency.js'

/**
 * A funding symbol is `f` followed by a tradable currency: fUSD, fBTC.
 *
 * `symbolValidator` checks against `data/symbols.js`, which holds 193 entries
 * and every one of them is a TRADING pair (`tBTCUSD`). There is not a single
 * `f`-prefixed entry in it, so validating a funding symbol against that list
 * rejects every funding symbol that exists -- which is why `FundingInfo`,
 * whose symbol is a funding symbol by definition, could not return null for
 * any input at all.
 */
export function fundingSymbolValidator (v: unknown): string | null {
  const invalid = 'must be a funding symbol for a currency currently tradable on Bitfinex'

  if (typeof v !== 'string' || v.charAt(0) !== 'f') return invalid

  return currencyValidator(v.slice(1)) === null ? null : invalid
}
