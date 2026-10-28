import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CURRENCIES, FundingCredit, FundingLoan, FundingOffer, FundingTicker, FundingTickerHist,
  FundingInfo, FundingTrade, Liquidations, Order, SYMBOLS, TradingTicker
} from '../dist/index.js'
import { currencyValidator } from '../dist/validators/currency.js'
import { fundingSymbolValidator } from '../dist/validators/funding-symbol.js'
import { symbolValidator } from '../dist/validators/symbol.js'

/**
 * Audit 2026-10-28 (round 2): symbolValidator checked membership in
 * data/symbols.ts, a 193-pair list frozen around tLEOUSD, so validate()
 * rejected real rows: every liquidation (tDOGEF0:USTF0), every funding
 * offer/trade/ticker (fUSD), and any modern pair (tSOLUSD, tAVAX:USD).
 *
 * The validators now check FORMAT. The oracle is the exchange's own listing,
 * recorded from the public conf endpoints in
 * test/recordings/conf-symbol-lists.json: every listed name must validate.
 */

const UA = { 'User-Agent': 'bfx-api-node-models symbol-validators test' }
const LIVE = !!process.env.LIVE_WIRE

interface ConfLists {
  _meta: { source: string, recorded: string, counts: Record<string, number> }
  lists: Record<'pair:exchange' | 'pair:margin' | 'pair:futures' | 'currency', string[]>
}

const conf = JSON.parse(readFileSync(
  fileURLToPath(new URL('./recordings/conf-symbol-lists.json', import.meta.url)), 'utf8'
)) as ConfLists

const PAIR_LISTS = ['pair:exchange', 'pair:margin', 'pair:futures'] as const

/** Not one of these is a symbol, under either prefix. */
const GARBAGE: readonly unknown[] = [
  '', 't', 'f', 'BTCUSD', 'tbtcusd', 'fusd', 'tBTCUS', 'tBTCUSDT', 'tBTC:', 't:USD', 'tBTC:USD:EUR',
  'tBT:USD', 'tBTC:US', ' tBTCUSD', 'tBTCUSD ', 'tBTCUSD\n', 'tBTC-USD', 'tBTC_USD', 'fU', 'fUS',
  'f1INCH', 't1INCHUSD', 'tUSD1NC', 'x'.repeat(50), `t${'A'.repeat(21)}:USD`, `f${'A'.repeat(21)}`,
  123, 0, null, undefined, true, {}, [], ['tBTCUSD']
]

describe('the conf snapshot describes itself honestly', () => {
  test('provenance is stated and dated', () => {
    assert.match(conf._meta.source, /^GET https:\/\/api-pub\.bitfinex\.com\/v2\/conf\/pub:list:/)
    assert.match(conf._meta.recorded, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('_meta.counts equals the recorded list lengths, and no list is empty', () => {
    for (const [k, v] of Object.entries(conf.lists)) {
      assert.equal(conf._meta.counts[k], v.length, k)
      assert.ok(v.length > 0, k)
    }
  })
})

describe('symbolValidator: trading symbols by format', () => {
  for (const list of PAIR_LISTS) {
    test(`every recorded ${list} pair validates as t + pair`, () => {
      const rejected = conf.lists[list].filter((p) => symbolValidator(`t${p}`) !== null)
      assert.deepEqual(rejected, [])
    })
  }

  test('the pairs the stale list rejected now validate', () => {
    for (const s of ['tTESTBTC:TESTUSD', 'tBTCUST', 'tSOLUSD', 'tAVAX:USD', 'tBTCF0:USTF0', 'tDOGEF0:USTF0']) {
      assert.equal(symbolValidator(s), null, s)
    }
  })

  test('the pairs the stale list accepted still validate', () => {
    for (const s of Object.values(SYMBOLS)) assert.equal(symbolValidator(s), null, s)
  })

  test('malformed values are rejected', () => {
    for (const v of GARBAGE) {
      assert.equal(symbolValidator(v), 'must be a trading symbol: t + BASEQUOTE (3+3) or t + BASE:QUOTE', String(v))
    }
  })

  test('a funding symbol is not a trading symbol', () => {
    for (const c of conf.lists.currency) assert.notEqual(symbolValidator(`f${c}`), null, c)
  })
})

describe('fundingSymbolValidator: f + currency by format', () => {
  test('every recorded currency validates as f + currency', () => {
    const rejected = conf.lists.currency.filter((c) => fundingSymbolValidator(`f${c}`) !== null)
    assert.deepEqual(rejected, [])
  })

  test('malformed values are rejected', () => {
    for (const v of GARBAGE) {
      assert.equal(fundingSymbolValidator(v), 'must be a funding symbol: f + a currency code', String(v))
    }
  })

  test('a trading symbol is not a funding symbol', () => {
    for (const s of ['tBTCUSD', 'tAVAX:USD', 'tBTCF0:USTF0']) assert.notEqual(fundingSymbolValidator(s), null, s)
  })
})

describe('currencyValidator: currency codes by format', () => {
  test('every recorded currency validates, and so does every pair side', () => {
    const sides = PAIR_LISTS.flatMap((l) => conf.lists[l])
      .flatMap((p) => (p.includes(':') ? p.split(':') : [p.slice(0, 3), p.slice(3)]))
    const rejected = [...conf.lists.currency, ...sides].filter((c) => currencyValidator(c) !== null)
    assert.deepEqual(rejected, [])
  })

  test('the currencies the stale list accepted still validate', () => {
    for (const c of Object.values(CURRENCIES)) assert.equal(currencyValidator(c), null, c)
  })

  test('malformed values are rejected', () => {
    for (const v of ['', 'US', 'usd', 'Usd', '1INCH', 'BTC:USD', 'tBTCUSD', 'USD ', 'x'.repeat(50), 'A'.repeat(21), 5, null]) {
      assert.equal(currencyValidator(v), 'must be a currency code: 3-20 uppercase letters or digits, starting with a letter', String(v))
    }
  })
})

describe('SYMBOLS and CURRENCIES stay exported with their legacy shape', () => {
  test('SYMBOLS keeps its BASE_QUOTE keys and 193 legacy pairs', () => {
    assert.equal(SYMBOLS.BTC_USD, 'tBTCUSD')
    assert.equal(SYMBOLS.LEO_USD, 'tLEOUSD')
    assert.equal(Object.keys(SYMBOLS).length, 193)
  })

  test('CURRENCIES keeps its CODE: CODE shape, UST included', () => {
    assert.equal(CURRENCIES.BTC, 'BTC')
    assert.equal(CURRENCIES.UST, 'UST')
  })
})

/** Shapes per docs.bitfinex.com (the same rows test/validate-false-reject.test.ts uses). */
const fundingOfferRow = (symbol: string): unknown[] => [
  41237920, symbol, 1793200000000, 1793200000000, 100, 100, 'LIMIT',
  null, null, 0, 'ACTIVE', null, null, null, 0.0002, 2, 0, 0, null, 0, null
]
/** docs.bitfinex.com/reference/rest-auth-funding-loans (credits add POSITION_PAIR at 21). */
const fundingLoanRow = (symbol: string): unknown[] => [
  2995368, symbol, 0, 1793200000000, 1793200000000, 200, 0, 'ACTIVE', 'FIXED',
  null, null, 0.0024, 2, 1793200000000, 1793200000000, 0, 0, null, 0, 0.0024, 0, 'tBTCUSD'
]

describe('models: the funding side validates f-symbols, the trading side t-symbols', () => {
  test('FundingOffer, FundingLoan and FundingCredit accept fUSD and reject a trading symbol', () => {
    for (const M of [FundingOffer, FundingLoan, FundingCredit]) {
      const row = M === FundingOffer ? fundingOfferRow : fundingLoanRow
      assert.equal(M.validate(row('fUSD')), null, M.name)
      assert.equal(M.validate(row('fTESTUSD')), null, M.name)
      assert.match(String(M.validate(row('tBTCUSD'))), /^Error: symbol:/, M.name)
    }
  })

  test('FundingTrade accepts fUSD and rejects a trading symbol', () => {
    const row = (s: string): unknown[] => [636854, s, 1793200000000, 41237920, -100, 0.0002, 2, null]
    assert.equal(FundingTrade.validate(row('fUSD')), null)
    assert.match(String(FundingTrade.validate(row('tBTCUSD'))), /^Error: symbol:/)
  })

  test('FundingInfo accepts an f-symbol and rejects a trading symbol', () => {
    const info = (symbol: string): Record<string, unknown> => ({
      symbol, yieldLoan: 0.0002, yieldLend: 0.0001, durationLoan: 30, durationLend: 2
    })
    assert.equal(FundingInfo.validate(info('fUSD')), null)
    assert.match(String(FundingInfo.validate(info('tBTCUSD'))), /^Error: symbol:/)
  })

  test('the recorded FundingTicker and FundingTickerHist rows validate unmodified', () => {
    const load = (n: string): { payload: unknown[] } => JSON.parse(readFileSync(
      fileURLToPath(new URL(`./fixtures/${n}.json`, import.meta.url)), 'utf8'))
    assert.equal(FundingTicker.validate(load('funding-ticker').payload), null)
    assert.equal(FundingTickerHist.validate(load('funding-ticker-hist').payload), null)
  })

  test('TradingTicker and Order still reject a funding symbol', () => {
    assert.match(String(TradingTicker.validate({ symbol: 'fUSD' })), /^Error: symbol:/)
    assert.match(String(Order.validate({ symbol: 'fUSD' })), /symbol/)
  })

  test('Liquidations accepts a derivative pair the stale list lacked', () => {
    const row = ['pos', 194785434, 1793200266526, null, 'tDOGEF0:USTF0', -1000, 0.1, null, 1, 1, null, 0.12]
    assert.equal(Liquidations.validate(row), null)
  })
})

// Declarative `{ skip }`, never a body-return: see the note in wire-contract.test.ts.
for (const list of [...PAIR_LISTS, 'currency'] as const) {
  test(`live conf/pub:list:${list}: every listed name still validates`,
    { skip: LIVE ? false : 'set LIVE_WIRE=1' }, async () => {
      const res = await fetch(`https://api-pub.bitfinex.com/v2/conf/pub:list:${list}`, { headers: UA })
      assert.equal(res.status, 200)
      const names = ((await res.json()) as string[][])[0]
      assert.ok(names.length > 0)
      const check = list === 'currency'
        ? (n: string) => fundingSymbolValidator(`f${n}`)
        : (n: string) => symbolValidator(`t${n}`)
      assert.deepEqual(names.filter((n) => check(n) !== null), [],
        `Bitfinex lists names the format rejects; re-derive the pattern and re-record ${list}`)
    })
}
