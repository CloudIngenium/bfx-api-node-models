# Bitfinex positional-array index truth table

> Normative reference for `@cloudingenium/bfx-api-node-models`. Per
> `docs/design/positional-decoder-adoption.md` §2.2: this table **is the
> review artifact** for every PR that adopts this library as a Bitfinex
> decoder (PR-1 through PR-5). It is cross-checked against the official
> Bitfinex API docs (docs.bitfinex.com) and, where noted, against real
> **public, unauthenticated, no-money** payload captures recorded 2026-07-05,
> 2026-09-25 (WS ticker pushes) and 2026-10-28 (liquidations, public trades,
> `status/deriv?keys=ALL`, WS ticker frames; see `test/fixtures/*.json`). Every model file also carries a short
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
(`test/fixtures/status-messages-deriv.json`, and every key in
`test/fixtures/status-messages-deriv-all.json`). Completed in PR-1 — see H1:
additive only, no existing index shifted.

Validators (audit 2026-10-28, models-validate-false-reject-06): funding is
signed, so `fundingAccrued` (9) and `currentFunding` (12) validate as any
finite number — 62 of the 92 rows in the `keys=ALL` capture carry a negative
value in one of them, and the old greater-than-zero check rejected every one.
`clampMax` (23) accepts `null`, which the capture shows for
`tSPAIN35IXF0:USTF0`.

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
| 17 | FIRST_TRADE | `firstTrade` | **added PR-1** (also on the WS `fticker` push, at index 16 — see below) |

Source: docs.bitfinex.com/reference/rest-public-tickers.

**Former gap, fixed in audit round 2 (2026-10-28):** `symbolValidator` used
to read from `src/data/symbols.ts`, a static trading-pairs-only snapshot with
zero funding-currency (`f`-prefixed) entries, so `FundingTicker.validate()`
always failed the `symbol` field on real data (e.g. `fUSD`). The symbol and
currency validators now check format, the funding models validate `symbol`
with `fundingSymbolValidator`, and `test/symbol-validators.test.ts` holds
them to the live `conf/pub:list:*` listings
(`test/recordings/conf-symbol-lists.json`).

## `FundingTickerChannel` (`src/funding-ticker-channel.ts`) — WS `fticker` channel — **new in PR-1**

WS public `fticker` channel payload for a funding currency. Channel-scoped
(no `SYMBOL`), so every field is at index-1 relative to `FundingTicker`,
`FIRST_TRADE` included: an earlier revision of this table called it
REST-only, but recorded `fUSD` ticker frames (2026-09-25 and 2026-10-28)
are 17 elements long and end in `1469734163000` at index 16. **Live-verified**
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
| 16 | FIRST_TRADE | `firstTrade` (nullable) |

Source: docs.bitfinex.com/reference/ws-public-ticker (funding currency row).

## `TradingTickerChannel` (`src/trading-ticker-channel.ts`) — WS `ticker` channel, trading pair

Channel-scoped (no `SYMBOL`), so every field is at index-1 relative to
`TradingTicker`. **Live-verified**: recorded `tBTCUSD` ticker frames
(2026-09-25 and 2026-10-28) are 11 elements long and end in
`1358182043000` at index 10 (`test/fixtures/trading-ticker-channel.json`).

| Index | Field | Model field |
|---|---|---|
| 0 | BID | `bid` |
| 1 | BID_SIZE | `bidSize` |
| 2 | ASK | `ask` |
| 3 | ASK_SIZE | `askSize` |
| 4 | DAILY_CHANGE | `dailyChange` |
| 5 | DAILY_CHANGE_RELATIVE | `dailyChangePerc` |
| 6 | LAST_PRICE | `lastPrice` |
| 7 | VOLUME | `volume` |
| 8 | HIGH | `high` |
| 9 | LOW | `low` |
| 10 | FIRST_TRADE | `firstTrade` (nullable) |

Source: docs.bitfinex.com/reference/ws-public-ticker (trading pair row).

## `Liquidations` (`src/liquidations.ts`) — REST `GET /v2/liquidations/hist`

**Live-verified** (`test/fixtures/liquidations.json`, recorded 2026-10-28).
The response wraps every row one level deeper than other collections —
`[[["pos", ...]], [["pos", ...]], ...]` — and `Liquidations.unserialize()` /
`validate()` peel that level off, so a full response decodes to one object
per row. `isMatch` / `isMarketSold` are the wire 0/1 and stay numbers (no
`boolFields`), so they validate as 0 or 1, not as booleans.

| Index | Field | Model field | Status |
|---|---|---|---|
| 0 | `"pos"` | — | constant tag |
| 1 | POS_ID | `posId` | pre-existing |
| 2 | MTS | `mtsUpdated` | pre-existing |
| 3 | *placeholder* | — | — |
| 4 | SYMBOL | `symbol` | pre-existing |
| 5 | AMOUNT | `amount` | pre-existing |
| 6 | BASE_PRICE | `basePrice` | pre-existing |
| 7 | *placeholder* | — | — |
| 8 | IS_MATCH | `isMatch` | pre-existing (validator fixed: 0/1, was `boolValidator`) |
| 9 | IS_MARKET_SOLD | `isMarketSold` | pre-existing (validator fixed: 0/1, was `boolValidator`) |
| 10 | *placeholder* | — | — |
| 11 | PRICE_ACQUIRED (docs name) | `liquidationPrice` | **added 2026-10-28** (nullable; `null` on live rows; named after upstream bitfinexcom/bfx-api-node-models PR #59) |

Source: docs.bitfinex.com/reference/rest-public-liquidations.

## `PublicTrade` (`src/public-trade.ts`) — REST `trades/{symbol}/hist`, WS `trades`

Two layouts, chosen by the **width of a row** (for a collection, its first
row), never by the collection's length: a 5-row trading snapshot used to
decode with the funding layout until 2026-10-28. **Live-verified**
(`test/fixtures/public-trades-trading.json`,
`test/fixtures/public-trades-funding.json`, both 5-row `limit=5` captures).

| Layout | Width | Index → model field |
|---|---|---|
| Trading pair (`t…`) | 4 | 0 ID `id`, 1 MTS `mts`, 2 AMOUNT `amount`, 3 PRICE `price` |
| Funding currency (`f…`) | 5 | 0 ID `id`, 1 MTS `mts`, 2 AMOUNT `amount`, 3 RATE `rate`, 4 PERIOD `period` |

Source: docs.bitfinex.com/reference/rest-public-trades and ws-public-trades.

## Order book (`src/order-book.ts`) — REST `book/{symbol}/{P0|R0}`, WS `book`

Rows stay positional arrays; the model tells trading from funding by row
width (4 = funding). Checksum semantics are documented with the order-book
fixes, not here.

| Precision | Layout | Width | Index → field |
|---|---|---|---|
| P0 (aggregated) | Trading | 3 | 0 PRICE, 1 COUNT, 2 AMOUNT |
| P0 (aggregated) | Funding | 4 | 0 RATE, 1 PERIOD, 2 COUNT, 3 AMOUNT |
| R0 (raw) | Trading | 3 | 0 ORDER_ID, 1 PRICE, 2 AMOUNT |
| R0 (raw) | Funding | 4 | 0 OFFER_ID, 1 PERIOD, 2 RATE, 3 AMOUNT |

Source: docs.bitfinex.com/reference/rest-public-book, ws-public-books and
ws-public-raw-books.

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
rateReal:20`. No index gap. Validators fixed 2026-10-28
(models-fundingoffer-validate-01): `validate()` carried validators for
`mtsOpening`, `mtsLastPayout` and `noClose` — FundingCredit/FundingLoan
fields with no slot in an offer row — so every array input failed with "no
field index declared". They are gone, and `rateReal` (a documented
placeholder sent as `null`) is nullable.

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
orderPrice:7, maker:8, fee:9, feeCurrency:10, cid:11`.

| Index | Field | Model field | Status |
|---|---|---|---|
| 3 | ORDER_ID | `orderID` | pre-existing (validator fixed 2026-10-28: a number, was `stringValidator`) |
| 9, 10 | FEE, FEE_CURRENCY | `fee`, `feeCurrency` | pre-existing (validators nullable 2026-10-28: a `te` row sends both as `null`; the fee arrives on `tu`) |
| 11 | CID | `cid` | **added 2026-10-28** (models-trade-cid-05; nullable — `null` for orders placed without a client id, absent on 11-element rows) |

Trade rows are authenticated, so the tests use rows shaped per the docs page,
not a recording.

### `FundingTrade` (`src/funding-trade.ts`)

docs.bitfinex.com/reference/rest-auth-funding-trades: `id:0, symbol:1,
mtsCreate:2, offerID:3, amount:4, rate:5, period:6, maker:7`. `maker` is
1 or null on the wire (ws-auth-funding-trades: "1 if true, null if false";
the REST hist row sends a null placeholder) and stays a number (no
`boolFields`); it validates as 1, 0 or null since
2026-10-28 (was `boolValidator`, which rejected every real row).

### `Wallet` / `WalletHist` — wallet types

`WALLET_TYPES` (`src/data/wallet-types.ts`) lists `exchange`, `margin` and
`funding` (the names Bitfinex serves today, docs.bitfinex.com/reference/
rest-auth-wallets) plus the legacy `trading` and `deposit`, which
`WalletHist.type` keeps exposing. Before 2026-10-28 `margin` and `funding`
wallets failed `validate()`.

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
dailyChangePerc:6, lastPrice:7, volume:8, high:9, low:10, firstTrade:11`.
`FIRST_TRADE` (index 11, `1358182043000` in the live capture) was appended
by Bitfinex on 2026-09-23 and is modeled as a nullable `firstTrade`; the WS
`ticker` push carries the same value at index 10 (`TradingTickerChannel`
above).
