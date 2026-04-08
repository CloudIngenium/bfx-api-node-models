import { SYMBOLS } from './symbols.js'

const currencySet = new Set<string>()

for (const sym of Object.values(SYMBOLS)) {
  currencySet.add(sym.substring(1, 4))
  currencySet.add(sym.substring(4))
}

currencySet.add('UST')

export const CURRENCIES: Record<string, string> = {}

for (const ccy of currencySet) {
  CURRENCIES[ccy] = ccy
}
