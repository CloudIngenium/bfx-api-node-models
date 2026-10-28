import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  FundingOffer, FundingTrade, StatusMessagesDeriv, Wallet, WalletHist, WALLET_TYPES
} from '../dist/index.js'

/**
 * Audit 2026-10-28 (models-fundingoffer-validate-01, models-validate-false-reject-06):
 * validate() rejected well-formed rows the exchange actually sends.
 *
 * Funding offers, funding trades and wallets are authenticated, so no public
 * recording exists; their rows are shaped exactly per the docs.bitfinex.com
 * page each test names, the convention test/order.test.ts uses. The
 * derivatives status rows are a public recording (fixture).
 *
 * The funding rows use a listed TRADING symbol because the static
 * data/symbols.ts snapshot has no f-prefixed entries (the known
 * symbols-freshness gap in docs/positional-index-truth-table.md); a real
 * fUSD row is still rejected on `symbol`, and only on `symbol`.
 */

/** docs.bitfinex.com/reference/rest-auth-funding-offers */
const fundingOfferRow = (symbol: string): unknown[] => [
  41237920, symbol, 1793200000000, 1793200000000, 100, 100, 'LIMIT',
  null, null, 0, 'ACTIVE', null, null, null, 0.0002, 2, 0, 0, null, 0, null
]

describe('FundingOffer: validate() has a validator only for mapped fields', () => {
  test('a documented offer row validates', () => {
    assert.equal(FundingOffer.validate(fundingOfferRow('tBTCUSD')), null)
  })

  test('no validator points at an unmapped field (mtsOpening, mtsLastPayout, noClose)', () => {
    const err = FundingOffer.validate(fundingOfferRow('fUSD'))
    assert.doesNotMatch(String(err), /no field index declared/)
    assert.match(String(err), /^Error: symbol:/)
  })
})

/**
 * docs.bitfinex.com/reference/ws-auth-funding-trades: MAKER is 1 if true and
 * null if false; rest-auth-funding-trades-hist sends index 7 as a null
 * placeholder.
 */
const fundingTradeRow = (maker: unknown): unknown[] => [
  636854, 'tBTCUSD', 1793200000000, 41237920, -100, 0.0002, 2, maker
]

describe('FundingTrade: maker is the wire 1 / null (0 tolerated)', () => {
  for (const maker of [null, 1, 0]) {
    test(`maker ${maker} validates`, () => {
      assert.equal(FundingTrade.validate(fundingTradeRow(maker)), null)
    })
  }

  test('maker outside 0/1 is rejected', () => {
    assert.match(String(FundingTrade.validate(fundingTradeRow(2))), /^Error: maker:/)
  })
})

/** docs.bitfinex.com/reference/rest-auth-wallets / ws-auth-wallets */
const walletRow = (type: string): unknown[] => [type, 'USD', 100, 0, 100, 'Deposit (USD)', null]

describe('Wallet types: the live names, plus the legacy ones WalletHist exposes', () => {
  test('WALLET_TYPES lists exchange, margin and funding, and keeps trading and deposit', () => {
    for (const t of ['exchange', 'margin', 'funding', 'trading', 'deposit']) {
      assert.ok((WALLET_TYPES as readonly string[]).includes(t), t)
    }
  })

  for (const t of ['exchange', 'margin', 'funding']) {
    test(`Wallet.validate accepts a ${t} wallet`, () => {
      assert.equal(Wallet.validate(walletRow(t)), null)
    })
  }

  test('WalletHist.type keeps TRADING and DEPOSIT and gains MARGIN and FUNDING', () => {
    assert.equal(WalletHist.type.TRADING, 'trading')
    assert.equal(WalletHist.type.DEPOSIT, 'deposit')
    assert.equal(WalletHist.type.MARGIN, 'margin')
    assert.equal(WalletHist.type.FUNDING, 'funding')
  })

  test('an unknown wallet type is still rejected', () => {
    assert.match(String(Wallet.validate(walletRow('savings'))), /^Error: type:/)
  })
})

describe('StatusMessagesDeriv: signed fields accept the recorded negative values', () => {
  const f = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/status-messages-deriv-all.json', import.meta.url)), 'utf8'
  )) as { rows: Array<[string, unknown[]]> }
  const rows = f.rows.map(([, row]) => row)

  test('the recording carries the negative funding and null clamp it is meant to cover', () => {
    assert.ok(rows.filter((r) => (r[9] as number) < 0 || (r[12] as number) < 0).length >= 62)
    assert.ok(rows.some((r) => r[23] === null))
  })

  test('every recorded /status/deriv?keys=ALL row validates', () => {
    for (const row of rows) {
      assert.equal(StatusMessagesDeriv.validate(row), null, String(row[0]))
    }
  })

  test('a non-numeric currentFunding is still rejected', () => {
    const bad = [...rows[0]]; bad[12] = 'x'
    assert.match(String(StatusMessagesDeriv.validate(bad)), /^Error: currentFunding:/)
  })
})
