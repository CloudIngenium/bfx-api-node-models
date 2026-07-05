import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { StatusMessagesDeriv } from '../dist/status-messages-deriv.js'

const fixturePath = fileURLToPath(new URL('./fixtures/status-messages-deriv.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  payload: unknown[]
  expected: Record<string, unknown>
}

test('StatusMessagesDeriv — unserializes all 13 completed fields from a recorded fixture (F5)', () => {
  const result = StatusMessagesDeriv.unserialize(fixture.payload) as Record<string, unknown>
  assert.deepEqual(result, fixture.expected)
})

test('StatusMessagesDeriv — H1: the original 9 pre-PR-1 fields keep their exact indices', () => {
  // Regression guard for H1: field additions must not shift existing indices;
  // a consumer pinned to the old 9 fields must behave identically.
  const originalFields = {
    key: 0,
    timestamp: 1,
    price: 3,
    priceSpot: 4,
    fundBal: 6,
    fundingAccrued: 9,
    fundingStep: 10,
    clampMin: 22,
    clampMax: 23
  }

  const result = StatusMessagesDeriv.unserialize(fixture.payload) as Record<string, unknown>

  for (const [name, index] of Object.entries(originalFields)) {
    assert.equal(result[name], fixture.payload[index], `${name} must still read from index ${index}`)
  }
})

test('StatusMessagesDeriv — validate() accepts a recorded real payload', () => {
  const err = StatusMessagesDeriv.validate(fixture.payload)
  assert.equal(err, null)
})

test('StatusMessagesDeriv — new fields expose the previously hand-decoded gap (FundingCostTracker.ts)', () => {
  const model = new StatusMessagesDeriv(fixture.payload) as unknown as Record<string, unknown>
  assert.equal(model.nextFundingEvtMts, fixture.payload[8])
  assert.equal(model.currentFunding, fixture.payload[12])
  assert.equal(model.markPrice, fixture.payload[15])
  assert.equal(model.openInterest, fixture.payload[18])
})
