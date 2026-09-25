import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numberValidator } from '../dist/validators/number.js'
import { amountValidator } from '../dist/validators/amount.js'
import { priceValidator } from '../dist/validators/price.js'
import { dateValidator } from '../dist/validators/date.js'
import { boolValidator } from '../dist/validators/bool.js'
import { stringValidator } from '../dist/validators/string.js'
import { symbolValidator } from '../dist/validators/symbol.js'
import { currencyValidator } from '../dist/validators/currency.js'
import { nullable } from '../dist/validators/nullable.js'

// Every validator returns `null` on success and a bare message on failure —
// `Model.validate` is what prefixes the field name. The exact strings are
// asserted because consumers match on them (see trading-ticker.test.ts).

// ---------------------------------------------------------------------- number

test('numberValidator — accepts finite numbers, including zero and negatives', () => {
  assert.equal(numberValidator(0), null)
  assert.equal(numberValidator(83780), null)
  assert.equal(numberValidator(-0.0001445), null)
})

test('numberValidator — rejects non-finite and non-number input with "must be a number"', () => {
  for (const v of [NaN, Infinity, -Infinity, '83780', null, undefined, {}, [], true]) {
    assert.equal(numberValidator(v), 'must be a number', `${String(v)} must be rejected`)
  }
})

// ---------------------------------------------------------------------- amount

test('amountValidator — accepts any finite number, sign included', () => {
  assert.equal(amountValidator(1.5), null)
  assert.equal(amountValidator(-1.5), null)
  assert.equal(amountValidator(0), null)
})

test('amountValidator — delegates to numberValidator, message and all', () => {
  assert.equal(amountValidator('1.5'), 'must be a number')
  assert.equal(amountValidator(NaN), 'must be a number')
  assert.equal(amountValidator(undefined), numberValidator(undefined))
})

// ----------------------------------------------------------------------- price

test('priceValidator — accepts positive numbers and zero', () => {
  assert.equal(priceValidator(83782), null)
  assert.equal(priceValidator(0.00017538972), null)
  assert.equal(priceValidator(0), null)
})

test('priceValidator — rejects negatives', () => {
  assert.equal(priceValidator(-1), 'must be a number greater than zero')
})

test('priceValidator — reports its own message for non-numbers, not numberValidator\'s', () => {
  for (const v of ['83782', NaN, null, undefined, {}]) {
    assert.equal(priceValidator(v), 'must be a number greater than zero', `${String(v)} must be rejected`)
  }
})

// ------------------------------------------------------------------------ date

test('dateValidator — accepts millisecond timestamps and Date instances', () => {
  assert.equal(dateValidator(1790359209000), null)
  assert.equal(dateValidator(new Date(1790359209000)), null)
  assert.equal(dateValidator(0), null)
})

test('dateValidator — rejects negative and unparseable values', () => {
  assert.equal(dateValidator(-1), 'must be a date or positive number')
  assert.equal(dateValidator('yesterday'), 'must be a date or positive number')
  assert.equal(dateValidator(undefined), 'must be a date or positive number')
  assert.equal(dateValidator(NaN), 'must be a date or positive number')
  assert.equal(dateValidator({}), 'must be a date or positive number')
})

test('dateValidator — coerces before testing, so null and numeric strings pass', () => {
  // Documented behaviour, not an endorsement: the validator uses `+v`, and
  // `+null === 0`. Models that must reject null wrap this in `nullable`-aware
  // field maps rather than relying on the validator.
  assert.equal(dateValidator(null), null)
  assert.equal(dateValidator('1790359209000'), null)
})

// ------------------------------------------------------------------------ bool

test('boolValidator — accepts only real booleans', () => {
  assert.equal(boolValidator(true), null)
  assert.equal(boolValidator(false), null)
})

test('boolValidator — rejects the wire 1/0 form and everything else', () => {
  for (const v of [1, 0, 'true', null, undefined, {}]) {
    assert.equal(boolValidator(v), 'must be a bool', `${String(v)} must be rejected`)
  }
})

// ---------------------------------------------------------------------- string

test('stringValidator — accepts any string when no options are given', () => {
  assert.equal(stringValidator('tBTCUSD'), null)
  assert.equal(stringValidator(''), null)
})

test('stringValidator — rejects non-strings with "must be a string"', () => {
  for (const v of [1, null, undefined, {}, [], true]) {
    assert.equal(stringValidator(v), 'must be a string', `${String(v)} must be rejected`)
  }
})

test('stringValidator — with validOptions, accepts a member of the set', () => {
  assert.equal(stringValidator('EXCHANGE', ['EXCHANGE', 'MARGIN']), null)
  assert.equal(stringValidator('MARGIN', ['EXCHANGE', 'MARGIN']), null)
})

test('stringValidator — with validOptions, rejects a string outside the set', () => {
  assert.equal(stringValidator('FUNDING', ['EXCHANGE', 'MARGIN']), 'must be a string')
})

test('stringValidator — an empty validOptions list rejects every string', () => {
  assert.equal(stringValidator('anything', []), 'must be a string')
})

// ---------------------------------------------------------------------- symbol

test('symbolValidator — accepts a pair present in src/data/symbols.ts', () => {
  assert.equal(symbolValidator('tBTCUSD'), null)
  assert.equal(symbolValidator('tETHUSD'), null)
})

test('symbolValidator — rejects unknown symbols', () => {
  assert.equal(symbolValidator('tNOPEUSD'), 'must be a symbol currently traded on Bitfinex')
  assert.equal(symbolValidator(''), 'must be a symbol currently traded on Bitfinex')
  assert.equal(symbolValidator(null), 'must be a symbol currently traded on Bitfinex')
  assert.equal(symbolValidator(42), 'must be a symbol currently traded on Bitfinex')
})

test('symbolValidator — rejects every funding symbol (known data gap)', () => {
  // src/data/symbols.ts is a trading-pairs-only snapshot with zero
  // f-prefixed entries, so any funding model validating `symbol` fails on
  // correct live data. Asserted so the gap is visible, not silent; see
  // docs/positional-index-truth-table.md "Known gap".
  assert.equal(symbolValidator('fUSD'), 'must be a symbol currently traded on Bitfinex')
})

// -------------------------------------------------------------------- currency

test('currencyValidator — accepts currencies derived from the symbol list', () => {
  assert.equal(currencyValidator('BTC'), null)
  assert.equal(currencyValidator('USD'), null)
  assert.equal(currencyValidator('ETH'), null)
})

test('currencyValidator — accepts UST, which is added on top of the derived set', () => {
  assert.equal(currencyValidator('UST'), null)
})

test('currencyValidator — rejects unknown currencies', () => {
  assert.equal(currencyValidator('NOPE'), 'must be a currency currently tradable on Bitfinex')
  assert.equal(currencyValidator('btc'), 'must be a currency currently tradable on Bitfinex')
  assert.equal(currencyValidator(null), 'must be a currency currently tradable on Bitfinex')
})

// -------------------------------------------------------------------- nullable

test('nullable — null passes without calling the inner validator', () => {
  let called = false
  const spy = (): string | null => { called = true; return 'inner ran' }

  assert.equal(nullable(spy)(null), null)
  assert.equal(called, false)
})

test('nullable — undefined passes too (a payload that omits a trailing field)', () => {
  assert.equal(nullable(numberValidator)(undefined), null)
})

test('nullable — a valid value delegates to the inner validator', () => {
  assert.equal(nullable(numberValidator)(1790359209000), null)
  assert.equal(nullable(priceValidator)(83782), null)
})

test('nullable — an invalid value returns the inner validator\'s message verbatim', () => {
  assert.equal(nullable(numberValidator)('not-a-number'), 'must be a number')
  assert.equal(nullable(priceValidator)(-1), 'must be a number greater than zero')
  assert.equal(nullable(dateValidator)('yesterday'), 'must be a date or positive number')
  assert.equal(nullable(symbolValidator)('fUSD'), 'must be a symbol currently traded on Bitfinex')
})

test('nullable — the wrapper is reusable and does not leak state between calls', () => {
  const guarded = nullable(numberValidator)
  assert.equal(guarded(1), null)
  assert.equal(guarded('x'), 'must be a number')
  assert.equal(guarded(null), null)
  assert.equal(guarded(2), null)
})
