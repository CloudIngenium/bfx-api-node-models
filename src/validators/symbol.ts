import { CURRENCY_PATTERN } from './currency.js'

/** The compact form: two 3-character currency codes, no separator (tBTCUSD). */
const COMPACT = '[A-Z][A-Z0-9]{2}[A-Z][A-Z0-9]{2}'

/** The separated form, used once either side is longer than 3 (tAVAX:USD, tBTCF0:USTF0). */
const SEPARATED = `${CURRENCY_PATTERN}:${CURRENCY_PATTERN}`

const TRADING_SYMBOL_RE = new RegExp(`^t(?:${COMPACT}|${SEPARATED})$`)

/**
 * A trading symbol: `t` + BASEQUOTE (3+3) or `t` + BASE:QUOTE, each side a
 * currency code (see `currencyValidator`). Derivative pairs are the separated
 * form with F0 codes (tBTCF0:USTF0).
 *
 * This checks FORMAT, not membership. It used to check `data/symbols.js`, a
 * static 193-pair list ending around tLEOUSD, so validate() rejected every
 * pair listed since: tSOLUSD, tBTCUST, tAVAX:USD, tTESTBTC:TESTUSD and every
 * derivative in a liquidation row. Every pair in the live
 * `conf/pub:list:pair:{exchange,margin,futures}` listings matches this
 * (test/recordings/conf-symbol-lists.json). Whether a pair is listed TODAY is
 * the exchange's answer to give, not a frozen list's.
 *
 * Funding symbols (fUSD) are not trading symbols: see `fundingSymbolValidator`.
 */
export function symbolValidator (v: unknown): string | null {
  return typeof v === 'string' && TRADING_SYMBOL_RE.test(v)
    ? null
    : 'must be a trading symbol: t + BASEQUOTE (3+3) or t + BASE:QUOTE'
}
