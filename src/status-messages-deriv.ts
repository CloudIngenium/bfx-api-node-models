import { stringValidator } from './validators/string.js'
import { priceValidator } from './validators/price.js'
import { dateValidator } from './validators/date.js'
import { Model } from './model.js'

// Field indices per docs.bitfinex.com/reference/rest-public-derivatives-status
// (REST /status/deriv array shape — see docs/positional-index-truth-table.md).
// H1: additive-only — do not shift/reuse these indices; a consumer pinned to
// the original 9 fields (key, timestamp, price, priceSpot, fundBal,
// fundingAccrued, fundingStep, clampMin, clampMax) must behave identically.
// timestamp was validated as a string pre-PR-1, which real payloads (a ms
// epoch number, e.g. 1783282202000) always fail — fixed alongside
// nextFundingEvtMts (same ms-epoch shape) since both are being normatively
// re-verified against a recorded fixture here (F5); no index changed.
const fields = {
key: 0,
  timestamp: 1,
  price: 3,
  priceSpot: 4,
  fundBal: 6,
  nextFundingEvtMts: 8,
  fundingAccrued: 9,
  fundingStep: 10,
  currentFunding: 12,
  markPrice: 15,
  openInterest: 18,
  clampMin: 22,
  clampMax: 23
}

export class StatusMessagesDeriv extends Model {
  constructor (data: unknown = {}) {
    super({ data, fields })
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields })
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields,
      validators: {
        key: stringValidator,
        timestamp: dateValidator,
        price: priceValidator,
        priceSpot: priceValidator,
        fundBal: priceValidator,
        nextFundingEvtMts: dateValidator,
        fundingAccrued: priceValidator,
        fundingStep: priceValidator,
        currentFunding: priceValidator,
        markPrice: priceValidator,
        openInterest: priceValidator,
        clampMin: priceValidator,
        clampMax: priceValidator
      }
    })
  }
}
