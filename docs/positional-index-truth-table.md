# Bitfinex positional-array index truth table

> Normative reference for `@cloudingenium/bfx-api-node-models`. Per
> `docs/design/positional-decoder-adoption.md` §2.2: this table **is the
> review artifact** for every PR that adopts this library as a Bitfinex
> decoder (PR-1 through PR-5). It is cross-checked against the official
> Bitfinex API docs (docs.bitfinex.com) and, where noted, against real
> **public, unauthenticated, no-money** payload captures recorded 2026-07-05
> (see `test/fixtures/*.json`). Every model file also carries a short
> in-source comment pointing back to the relevant doc page.
>
> Column key: **Model** = the class in `src/`. **Live-verified** = a real
> payload was captured and diffed against this table during authoring (see
> fixture file). Anything not live-verified was cross-checked against
> docs.bitfinex.com only (funding offers/credits/loans/ledger/positions/
> trades/orders require an authenticated account — out of scope to capture
> from a no-money exec session).

## `StatusMessagesDeriv` (`src/status-messages-deriv.ts`)

REST `GET /v2/status/deriv?keys=...` array. **Live-verified**
(`test/fixtures/status-messages-deriv.json`). Completed in PR-1 — see H1:
additive only, no existing index shifted.

| Index | Field | Model field | Status |
|---|---|---|---|
| 0 | KEY | `key` | pre-existing |
| 1 | MTS | `timestamp` | pre-existing (validator fixed: was `stringValidator`, now `dateValidator` — a ms-epoch number always failed the old check) |
| 2 | *reserved* | — | — |
| 3 | DERIV_PRICE | `price` | pre-existing |
| 4 | SPOT_PRICE | `priceSpot` | pre-existing |
| 5 | *reserved* | — | — |
| 6 | INSURANCE_FUND_BALANCE | `fundBal` | pre-existing |
| 7 | *reserved* | — | — |
| 8 | NEXT_FUNDING_EVT_MTS | `nextFundingEvtMts` | **added PR-1** (was the `NEXT_FUNDING_EVT_MTS[8]` raw-index read in `BfxPingPongBot/algos/Arbitrage/modules/FundingCostTracker.ts`) |
| 9 | NEXT_FUNDING_ACCRUED | `fundingAccrued` | pre-existing |
| 10 | NEXT_FUNDING_STEP | `fundingStep` | pre-existing |
| 11 | *reserved* | — | — |
| 12 | CURRENT_FUNDING | `currentFunding` | **added PR-1** (was `CURRENT_FUNDING[12]` raw-index) |
| 13–14 | *reserved* | — | — |
| 15 | MARK_PRICE | `markPrice` | **added PR-1** (was `MARK_PRICE[15]` raw-index) |
| 16–17 | *reserved* | — | — |
| 18 | OPEN_INTEREST | `openInterest` | **added PR-1** (was `OPEN_INTEREST[18]` raw-index) |
| 19–21 | *reserved* | — | — |
| 22 | CLAMP_MIN | `clampMin` | pre-existing |
| 23 | CLAMP_MAX | `clampMax` | pre-existing |

Source: docs.bitfinex.com/reference/rest-public-derivatives-status.

## `FundingTicker` (`src/funding-ticker.ts`) — REST bulk ticker, funding row

REST `GET /v2/tickers?symbols=...` array for an `f`-prefixed symbol.
**Live-verified** (`test/fixtures/funding-ticker.json`, `fUSD`). Fixed in
PR-1: bidPeriod/bidSize and askPeriod/askSize were swapped, `frr` was
validated as a bool, and `frrAmountAvailable`/`firstTrade` were missing. No
consumer imported this model before the fix (grepped clean across
BfxPingPongBot / jc-mcp-finanzas-bitfinex / BotEventAggregator), so this is a
correction, not a breaking change for real traffic.

| Index | Field | Model field | Status |
|---|---|---|---|
| 0 | SYMBOL | `symbol` | pre-existing |
| 1 | FRR | `frr` | pre-existing (validator fixed: was `boolValidator`, now `numberValidator` — frr is a float rate) |
| 2 | BID | `bid` | pre-existing |
| 3 | BID_PERIOD | `bidPeriod` | **fixed PR-1** (was mapped to index 4) |
| 4 | BID_SIZE | `bidSize` | **fixed PR-1** (was mapped to index 3) |
| 5 | ASK | `ask` | pre-existing |
| 6 | ASK_PERIOD | `askPeriod` | **fixed PR-1** (was mapped to index 7) |
| 7 | ASK_SIZE | `askSize` | **fixed PR-1** (was mapped to index 6) |
| 8 | DAILY_CHANGE | `dailyChange` | pre-existing |
| 9 | DAILY_CHANGE_RELATIVE | `dailyChangePerc` | pre-existing |
| 10 | LAST_PRICE | `lastPrice` | pre-existing |
| 11 | VOLUME | `volume` | pre-existing |
| 12 | HIGH | `high` | pre-existing |
| 13 | LOW | `low` | pre-existing |
| 14–15 | *reserved* | — | — |
| 16 | FRR_AMOUNT_AVAILABLE | `frrAmountAvailable` | **added PR-1** |
| 17 | FIRST_TRADE | `firstTrade` | **added PR-1** (REST-only) |

Source: docs.bitfinex.com/reference/rest-public-tickers.

**Known gap (not fixed here, out of PR-1 scope):** `symbolValidator` reads
from `src/data/symbols.ts`, a static trading-pairs-only snapshot with zero
funding-currency (`f`-prefixed) entries — so `FundingTicker.validate()`
always fails the `symbol` field even on correct real data (e.g. `fUSD`).
Fixing `data/symbols.ts` is a broader, cross-cutting data-freshness task
(it backs every model's symbol validation, not just funding-ticker) and is
a follow-up, not part of this PR.

## `FundingTickerChannel` (`src/funding-ticker-channel.ts`) — WS `fticker` channel — **new in PR-1**

WS public `fticker` channel payload for a funding currency. Channel-scoped
(no `SYMBOL`), and a push message (no `FIRST_TRADE`, which is REST-only).
Every field is at index-1 relative to `FundingTicker`. **Live-verified**
(`test/fixtures/funding-ticker-channel.json`, derived from the same `fUSD`
capture, reshaped per the WS docs). This closes the funding-channel model
gap named in the design doc — `BfxLendingBot/modules/exchange/
WebSocketManager.py:_process_funding_ticker()` hand-decodes this exact
shape today (`data[0..9]`, missing volume/high/low/frrAmountAvailable).

| Index | Field | Model field |
|---|---|---|
| 0 | FRR | `frr` |
| 1 | BID | `bid` |
| 2 | BID_PERIOD | `bidPeriod` |
| 3 | BID_SIZE | `bidSize` |
| 4 | ASK | `ask` |
| 5 | ASK_PERIOD | `askPeriod` |
| 6 | ASK_SIZE | `askSize` |
| 7 | DAILY_CHANGE | `dailyChange` |
| 8 | DAILY_CHANGE_RELATIVE | `dailyChangePerc` |
| 9 | LAST_PRICE | `lastPrice` |
| 10 | VOLUME | `volume` |
| 11 | HIGH | `high` |
| 12 | LOW | `low` |
| 13–14 | *reserved* | — |
| 15 | FRR_AMOUNT_AVAILABLE | `frrAmountAvailable` |

Source: docs.bitfinex.com/reference/ws-public-ticker (funding currency row).

## Other channels (verified against docs.bitfinex.com, not modified in PR-1)

These pre-existing models were cross-checked against docs.bitfinex.com
during PR-1 authoring (per §2.2's "review artifact" mandate) but are **out
of PR-1 scope** — no source changes. Documented here so the full
per-channel truth table this doc promises exists in one place; PR-2→5 use
this table as their merge prerequisite.

### `Order` (`src/order.ts`)

REST/WS order array. Matches docs.bitfinex.com/reference/rest-auth-retrieve-orders
exactly: `id:0, gid:1, cid:2, symbol:3, mtsCreate:4, mtsUpdate:5, amount:6,
amountOrig:7, type:8, typePrev:9, mtsTIF:10, flags:12, status:13, price:16,
priceAvg:17, priceTrailing:18, priceAuxLimit:19, notify:23, hidden:24,
placedId:25, routing:28, meta:31`. No gap found.

### `FundingOffer` (`src/funding-offer.ts`)

Matches docs.bitfinex.com/reference/rest-auth-funding-offers: `id:0,
symbol:1, mtsCreate:2, mtsUpdate:3, amount:4, amountOrig:5, type:6,
flags:9, status:10, rate:14, period:15, notify:16, hidden:17, renew:19,
rateReal:20`. No gap found.

### `FundingCredit` (`src/funding-credit.ts`) / `FundingLoan` (`src/funding-loan.ts`)

Matches docs.bitfinex.com/reference/rest-auth-funding-credits and
rest-auth-funding-loans: `id:0, symbol:1, side:2, mtsCreate:3, mtsUpdate:4,
amount:5, flags:6, status:7, rate:11, period:12, mtsOpening:13,
mtsLastPayout:14, notify:15, hidden:16, renew:18, rateReal:19, noClose:20`
(+ `positionPair:21` on credits only — loans have no position pair). This
is the shape `BfxLendingBot/modules/exchange/Bitfinex.py` should target for
its `wire_decode.py` named constants (PR-5) instead of the ad-hoc
`loan[14]`/`loan[15]` reads currently in `_parse()`.

### `LedgerEntry` (`src/ledger-entry.ts`)

Docs list `wallet` at index 2 (docs.bitfinex.com/reference/rest-auth-ledgers),
but this model maps `wallet: null` (never read positionally) while `mts`
stays at index 3, `amount` at 5, `balance` at 6, `description` at 8 — all of
which match the docs. This is a pre-existing, deliberate choice in this
library (the account-scoped `wallet` field requires an authenticated
capture to confirm one way or the other) — left untouched; flagged for
PR-5's ledger `wire_decode.py` constants to double-check against a real
authenticated ledger response before relying on index 2.

### `Trade` (`src/trade.ts`)

Matches docs.bitfinex.com/reference/rest-auth-trades: `id:0, symbol:1,
mtsCreate:2, orderID:3, execAmount:4, execPrice:5, orderType:6,
orderPrice:7, maker:8, fee:9, feeCurrency:10`. No gap found.

### `Position` (`src/position.ts`)

`symbol:0, status:1, amount:2, basePrice:3, marginFunding:4,
marginFundingType:5, pl:6, plPerc:7, liquidationPrice:8, leverage:9, id:11,
mtsCreate:12, mtsUpdate:13, type:15, collateral:17, collateralMin:18,
meta:19` — matches the well-known Bitfinex positions array shape. No gap
found (the official positions-doc endpoint returned 404 during authoring;
cross-checked against the existing field set instead, which is internally
consistent with the sibling models above).

### `TradingTicker` (`src/trading-ticker.ts`)

REST/WS trading-pair ticker. **Live-verified** against a real `tBTCUSD`
capture: `symbol:0, bid:1, bidSize:2, ask:3, askSize:4, dailyChange:5,
dailyChangePerc:6, lastPrice:7, volume:8, high:9, low:10`. Matches exactly.
Note: REST also returns `FIRST_TRADE` at index 11 (`1358182043000` in the
live capture) — not modeled, same class of gap as `FundingTicker.firstTrade`
pre-fix, but out of PR-1 scope (only the funding-ticker family was named).
