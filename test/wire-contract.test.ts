import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { TradingTicker } from '../dist/trading-ticker.js'
import { FundingTicker } from '../dist/funding-ticker.js'
import { TradingTickerChannel } from '../dist/trading-ticker-channel.js'
import { FundingTickerChannel } from '../dist/funding-ticker-channel.js'
import { TradingTickerHist } from '../dist/trading-ticker-hist.js'
import { FundingTickerHist } from '../dist/funding-ticker-hist.js'
import { SymbolDetails } from '../dist/symbol-details.js'
import { StatusMessagesDeriv } from '../dist/status-messages-deriv.js'

// THIS PACKAGE DEFINES THE INDEX MAPS THE WHOLE FORK FAMILY READS.
//
// bfx-api-node-rest and bitfinex-api-node both carry a wire-contract guard, and both of
// them derive their expectations from `_fields` ON THE MODELS PUBLISHED FROM HERE. That
// makes this repo the definition site: if an index map here is wrong, every consumer is
// wrong in agreement with it, and their guards cannot see it — a guard cannot check the
// ruler it measures with.
//
// What rotted, three times in one week: a fixture is a snapshot of an external wire
// format that is only ever compared against ITSELF. When Bitfinex moves, the fixture
// keeps passing while describing a world that no longer exists. That is worse than no
// fixture at all, because the test's NAME still claims the coverage. Every instance was
// caught by a human reading an announcement; none by a test. Two layers close it:
//
//   L1 (offline, always) — a fixture must describe itself honestly (`_meta.elements`
//        equals the real payload width) and no model may map an index its fixture lacks.
//   L2 (live, opt-in)    — the declared width must still match what Bitfinex serves.
//
// L2 is opt-in because a third party's availability must never redden an unrelated PR;
// a guard that cries wolf gets muted, and a muted guard is the silence it was written to
// end. It runs on a schedule instead — see .github/workflows/wire-contract.yml.
const LIVE = !!process.env.LIVE_WIRE
const API = 'https://api-pub.bitfinex.com/v2'

/** Bitfinex 403s urllib/curl defaults; an explicit UA is required, not cosmetic. */
const UA = { 'User-Agent': 'bfx-api-node-models wire-contract test' }

type Ctor = new (data: never) => unknown
type FieldMap = Record<string, number | number[]>

/** One live surface whose row width must still equal `width`. */
interface Probe {
  readonly path: string
  readonly width: number
  /** Pulls the row(s) whose width is the contract out of a decoded response. */
  readonly rows: (body: unknown) => unknown[][]
}

interface WireContract {
  /** Fixture filename under test/fixtures/, without the .json. */
  readonly fixture: string
  /** The model whose `_fields` must fit inside this wire. */
  readonly Model: Ctor
  /** Live surfaces to probe. Empty is allowed only with a stated reason. */
  readonly probes: readonly Probe[]
  /**
   * Why this fixture has no live probe. Required when `probes` is empty, because "no live
   * check" and "no live check YET" are different states and only one of them is fine.
   */
  readonly whyNoLive?: string
}

const firstRow = (body: unknown): unknown[][] => [(body as unknown[][])[0]]
/** conf responses nest one level: [[ [pair, details], ... ]]. The DETAILS carry the wire. */
const confDetails = (body: unknown): unknown[][] =>
  ((body as unknown[][][])[0]).map((r) => (r as unknown[])[1] as unknown[])

const CONTRACTS: readonly WireContract[] = [
  {
    fixture: 'trading-ticker',
    Model: TradingTicker as Ctor,
    probes: [{ path: '/tickers?symbols=tBTCUSD', width: 12, rows: firstRow }]
  },
  {
    fixture: 'funding-ticker',
    Model: FundingTicker as Ctor,
    probes: [{ path: '/tickers?symbols=fUSD', width: 18, rows: firstRow }]
  },
  {
    fixture: 'trading-ticker-hist',
    Model: TradingTickerHist as Ctor,
    probes: [{ path: '/tickers/hist?symbols=tBTCUSD&limit=1', width: 13, rows: firstRow }]
  },
  {
    fixture: 'funding-ticker-hist',
    Model: FundingTickerHist as Ctor,
    probes: [],
    // Re-verified 2026-09-26: the endpoint returns [] for funding symbols. The fixture is
    // a hand-built row of the documented shape, and its own _meta says so.
    whyNoLive: '/tickers/hist serves trading symbols only; fUSD returns an empty array'
  },
  {
    fixture: 'status-messages-deriv',
    Model: StatusMessagesDeriv as Ctor,
    probes: [{ path: '/status/deriv?keys=tBTCF0:USTF0', width: 24, rows: firstRow }]
  },
  {
    fixture: 'trading-ticker-channel',
    Model: TradingTickerChannel as Ctor,
    probes: [],
    // Not an exemption: this exact push IS checked against the live socket, in
    // bitfinex-api-node's test/lib/wire-contract.ts. Probing it needs a WS client, and
    // this package deliberately has no runtime dependency beyond bignumber.js + crc-32.
    whyNoLive: 'WS-only; live width is asserted in bitfinex-api-node/test/lib/wire-contract.ts'
  },
  {
    fixture: 'funding-ticker-channel',
    Model: FundingTickerChannel as Ctor,
    probes: [],
    whyNoLive: 'WS-only; live width is asserted in bitfinex-api-node/test/lib/wire-contract.ts'
  },
  {
    fixture: 'symbol-details',
    Model: SymbolDetails as Ctor,
    // BOTH halves, deliberately. Spot details are 12 wide and futures only 10, with
    // minimumMargin mapped at sub-index 9 — futures has ZERO headroom. Probing only the
    // spot endpoint would leave the half that breaks first unwatched.
    probes: [
      { path: '/conf/pub:info:pair', width: 12, rows: confDetails },
      { path: '/conf/pub:info:pair:futures', width: 10, rows: confDetails }
    ]
  }
]

interface Fixture {
  _meta: { source?: string, recorded?: string, elements?: number | number[] }
  payload?: unknown[]
  rows?: [string, unknown[]][]
}

function load (name: string): Fixture {
  const p = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url))
  return JSON.parse(readFileSync(p, 'utf8')) as Fixture
}

/** Distinct widths this fixture actually contains, ascending. */
function actualWidths (f: Fixture): number[] {
  const w = f.payload
    ? [f.payload.length]
    : (f.rows ?? []).map(([, details]) => details.length)
  return [...new Set(w)].sort((a, b) => a - b)
}

/** What `_meta.elements` claims, normalised to the same ascending-distinct shape. */
function claimedWidths (f: Fixture): number[] | null {
  const e = f._meta.elements
  if (typeof e === 'number') return [e]
  if (Array.isArray(e) && e.every((n) => typeof n === 'number')) {
    return [...new Set(e)].sort((a, b) => a - b)
  }
  return null
}

/**
 * Highest FLAT index a model reads. Nested coordinates like SymbolDetails' [1, 0] address
 * a sub-array, so their OUTER index is what must fit the row; the inner index is checked
 * against the details width by `maxNestedIndex`.
 */
function maxFlatIndex (Model: Ctor): number {
  const probe = new Model([] as never) as { _fields: FieldMap }
  return Math.max(...Object.values(probe._fields).map((f) => (Array.isArray(f) ? f[0] : f)))
}

/** Highest index read INSIDE a nested sub-array, or -1 when the map is flat. */
function maxNestedIndex (Model: Ctor): number {
  const probe = new Model([] as never) as { _fields: FieldMap }
  const inner = Object.values(probe._fields)
    .filter((f): f is number[] => Array.isArray(f))
    .map((f) => f[f.length - 1])
  return inner.length > 0 ? Math.max(...inner) : -1
}

test('every fixture is claimed by a wire contract', () => {
  const dir = fileURLToPath(new URL('./fixtures/', import.meta.url))
  const onDisk = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
  const claimed = CONTRACTS.map((c) => c.fixture).sort()
  // A new fixture with no contract entry is the failure mode this catches: a captured
  // payload with nothing watching it, which is precisely how the last three drifts
  // survived. Adding a fixture must cost you a line in CONTRACTS.
  assert.deepEqual(claimed, onDisk,
    'test/fixtures/ and CONTRACTS disagree — add the missing entry (probes: [] + whyNoLive if it cannot be probed)')
})

test('a contract with no live probe says why', () => {
  for (const c of CONTRACTS) {
    if (c.probes.length === 0) {
      assert.ok((c.whyNoLive ?? '').length > 0,
        `${c.fixture}: no probes and no whyNoLive — an unexplained gap reads as a covered one`)
    }
  }
})

test('every declared probe width matches the fixture it guards', () => {
  // The live layer asserts against Probe.width, the offline layer against the fixture.
  // If those two ever disagree, one of them is watching a shape nothing else believes in.
  for (const c of CONTRACTS) {
    const widths = actualWidths(load(c.fixture))
    for (const p of c.probes) {
      assert.ok(widths.includes(p.width),
        `${c.fixture}: probe ${p.path} expects ${p.width}, but the fixture holds ${widths.join('/')}`)
    }
  }
})

for (const c of CONTRACTS) {
  test(`${c.fixture}: fixture describes its own width honestly`, () => {
    const f = load(c.fixture)
    const actual = actualWidths(f)
    assert.ok(actual.length > 0, `${c.fixture}: neither payload nor rows`)
    assert.ok((f._meta.source ?? '').length > 0, `${c.fixture}: _meta.source is empty`)
    assert.match(f._meta.recorded ?? '', /^\d{4}-\d{2}-\d{2}$/,
      `${c.fixture}: _meta.recorded must be an ISO date — provenance is what makes a stale capture visible`)
    const claimed = claimedWidths(f)
    // `elements` is the fixture's own claim about itself. Unchecked, it is just a comment,
    // and a comment cannot rot loudly.
    assert.notEqual(claimed, null,
      `${c.fixture}: _meta.elements must be a number, or an array of the distinct row widths`)
    assert.deepEqual(claimed, actual,
      `${c.fixture}: _meta.elements says ${JSON.stringify(f._meta.elements)}, the payload holds ${JSON.stringify(actual)}`)
  })

  test(`${c.fixture}: no label reads past the declared wire`, () => {
    const f = load(c.fixture)
    const actual = actualWidths(f)
    const flat = maxFlatIndex(c.Model)
    const nested = maxNestedIndex(c.Model)
    if (f.payload) {
      assert.ok(flat < actual[0],
        `${c.Model.name} maps index ${flat} but ${c.fixture} is only ${actual[0]} wide — that field reads undefined`)
    } else {
      // Multi-row (conf): the NARROWEST row binds. pub:info:pair:futures details are 10
      // long and minimumMargin sits at sub-index 9 — zero headroom. One more mapped field
      // and the futures half silently reads undefined while the spot half stays green.
      assert.ok(nested < actual[0],
        `${c.Model.name} reads sub-index ${nested} but the narrowest ${c.fixture} row is ${actual[0]} — futures would read undefined`)
    }
  })
}

// The skip below is the DECLARATIVE `{ skip }` option, and that is load-bearing.
//
// The obvious alternative — `test(..., async () => { if (!LIVE) return; ... })` — is a
// silent-pass generator: node:test reports an empty body as PASSED, so an offline run
// would print a tick beside "live ... is still 12 wide" having never opened a socket. The
// identical mutation was applied to the mocha sibling in bfx-api-node-rest and it
// SURVIVED, printing green for a check that did not run. `{ skip }` cannot do that: the
// runner records the test as skipped, with its reason, and the counters say 0 passed.
//
// Nothing here detects a future edit back to a body-return. This comment is the guard.
for (const c of CONTRACTS) {
  for (const p of c.probes) {
    test(`${c.fixture}: live ${p.path} is still ${p.width} wide`,
      { skip: LIVE ? false : 'set LIVE_WIRE=1' }, async () => {
        const res = await fetch(`${API}${p.path}`, { headers: UA })
        assert.equal(res.status, 200, `${p.path} -> HTTP ${res.status}`)
        const rows = p.rows(await res.json())
        assert.ok(rows.length > 0, `${p.path} returned no rows`)
        // EVERY row, not a sample: a width that varies per pair is exactly the drift that
        // a first-row check would wave through.
        for (const row of rows) {
          assert.equal(row.length, p.width,
            `Bitfinex now serves ${row.length} elements on ${p.path}; the contract declares ${p.width}. ` +
            'Re-capture test/fixtures/' + c.fixture + '.json, re-check the index map, and bump _meta.recorded.')
        }
      })
  }
}
