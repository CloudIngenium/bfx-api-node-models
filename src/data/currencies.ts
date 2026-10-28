import { SYMBOLS } from './symbols.js'

const currencySet = new Set<string>()

for (const sym of Object.values(SYMBOLS)) {
  currencySet.add(sym.substring(1, 4))
  currencySet.add(sym.substring(4))
}

currencySet.add('UST')

/**
 * Legacy set of currency codes (`CURRENCIES.BTC` is `'BTC'`), derived from the
 * frozen `SYMBOLS` snapshot plus UST.
 *
 * @deprecated Not a list of what Bitfinex lists today, and no validator reads
 * it any more: `currencyValidator` checks the code FORMAT. Kept frozen for the
 * same reason as `SYMBOLS`. For the live list, read the public
 * `conf/pub:list:currency` endpoint.
 */
export const CURRENCIES: Record<string, string> = {}

for (const ccy of currencySet) {
  CURRENCIES[ccy] = ccy
}
