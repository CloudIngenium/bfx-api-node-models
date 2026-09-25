import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SymbolDetails } from '../dist/symbol-details.js'

const fixturePath = fileURLToPath(new URL('./fixtures/symbol-details.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  rows: [string, unknown[]][]
  expected: Record<string, unknown>[]
}

const [marginSpot, plainSpot, derivative] = fixture.rows
const [marginSpotExpected, plainSpotExpected, derivativeExpected] = fixture.expected

test('SymbolDetails — unserializes recorded pub:info:pair rows', () => {
  const result = SymbolDetails.unserialize(fixture.rows) as Record<string, unknown>[]
  assert.deepEqual(result, fixture.expected)
})

test('SymbolDetails — exposes FIRST_TRADE from detail index 0', () => {
  const model = new SymbolDetails(marginSpot) as unknown as Record<string, unknown>
  assert.equal(model.firstTrade, marginSpot[1][0])
  assert.equal(model.firstTrade, marginSpotExpected.firstTrade)
})

test('SymbolDetails — order sizes keep their indices after the FIRST_TRADE mapping', () => {
  // The regression that matters to callers: MinOrderSizeService reads
  // minimumOrderSize by name, so a slot shift would silently place a wrong
  // minimum into ExecutionConstants rather than throw.
  const model = new SymbolDetails(marginSpot) as unknown as Record<string, unknown>
  assert.equal(model.minimumOrderSize, marginSpot[1][3])
  assert.equal(model.maximumOrderSize, marginSpot[1][4])
  assert.equal(model.initialMargin, marginSpot[1][8])
  assert.equal(model.minimumMargin, marginSpot[1][9])
})

test('SymbolDetails — margin is derived, and false for a non-margin spot pair', () => {
  assert.equal((new SymbolDetails(marginSpot) as unknown as Record<string, unknown>).margin, true)
  assert.equal((new SymbolDetails(plainSpot) as unknown as Record<string, unknown>).margin, false)
  assert.equal(plainSpotExpected.margin, false)
})

test('SymbolDetails — a futures row has only 10 details and still maps', () => {
  const model = new SymbolDetails(derivative) as unknown as Record<string, unknown>
  assert.equal(derivative[1].length, 10)
  assert.equal(model.firstTrade, derivativeExpected.firstTrade)
  assert.equal(model.initialMargin, derivativeExpected.initialMargin)
  assert.equal(model.margin, true)
})

test('SymbolDetails — unserialize() injects margin into the plain-object form', () => {
  const single = SymbolDetails.unserialize(plainSpot) as Record<string, unknown>
  assert.equal(single.margin, false)
})

test('SymbolDetails — validate() accepts every recorded row', () => {
  // Regression: Model.validate could not resolve nested [1, n] field paths,
  // so this returned an error for every real row regardless of its contents.
  for (const row of fixture.rows) {
    assert.equal(SymbolDetails.validate(row), null, `${row[0]} must validate`)
  }
})

test('SymbolDetails — validate() accepts null margins on a non-margin pair', () => {
  assert.equal(plainSpot[1][8], null)
  assert.equal(SymbolDetails.validate(plainSpot), null)
})

test('SymbolDetails — validate() rejects a malformed minimumOrderSize', () => {
  const row: [string, unknown[]] = [marginSpot[0], [...marginSpot[1]]]
  row[1][3] = 42
  const err = SymbolDetails.validate(row)
  assert.ok(err instanceof Error)
  assert.match(err.message, /^minimumOrderSize: /)
})

test('SymbolDetails — validate() rejects a malformed firstTrade', () => {
  const row: [string, unknown[]] = [marginSpot[0], [...marginSpot[1]]]
  row[1][0] = 'yesterday'
  const err = SymbolDetails.validate(row)
  assert.ok(err instanceof Error)
  assert.match(err.message, /^firstTrade: /)
})
