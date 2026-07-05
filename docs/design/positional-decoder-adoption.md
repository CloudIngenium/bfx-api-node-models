# Bitfinex positional-array decoding — adopt-and-complete this library as the single decoder

> Fable-5 design verdict (R10c, plan `2026-07-02-fable-5-high-roi-leverage`, 2026-07-05).
> Status: design ratified — §7 is the Sonnet exec queue. Grounding sweep: 2026-07-05 (BfxPingPongBot, BfxLendingBot, bfx-bot-shared-types, BotEventAggregator, jc-mcp-finanzas-bitfinex, jc-mcp-dash-bots, Dash/Briefing — read-only).
> Disjoint from `bfx-bot-shared-types/docs/design/wire-contract-guard.md`: that queue guards **Boundary A** (bots' own emitted snake_case JSON → Aggregator/Dash). This arc is the **upstream boundary** — parsing raw Bitfinex exchange REST/WS positional arrays into bot state, which wire-contract §9 explicitly puts out of its scope.

## §1 Evidence — what is actually true

Three independent decoders exist; none is complete; the magic-index surface is large and live-money-adjacent:

| Surface | Sites | Notes |
|---|---|---|
| **BfxPingPongBot** (TS, live-money) | **~350** genuine raw-array index reads + **125** `.field ?? arr[n]` fallback sites | Imports only `Order` from this library (3 sites); everything else hand-decodes |
| **BfxLendingBot** (Py, ~$4M, `.runtime-pin`) | **~21** in `modules/exchange/` | Uses `bfxapi` dataclasses for offers/credits/wallets, raw-index for loans/ledgers/WS tickers (`Bitfinex.py:3003-3007`, `WebSocketManager.py:1711-1718`) |
| **jc-mcp-finanzas-bitfinex** (TS, no-money) | **~126** in `src/bitfinex-client.ts` | A private, near-complete positional decoder duplicating this library |
| Dash/Briefing/dash-bots MCP | 0 | Healthy — consume typed Aggregator JSON |

**Known gaps in THIS library** (why the bots hand-decode instead of adopting):
- `StatusMessagesDeriv` maps only **9 of 14+ fields** — `BfxPingPongBot/algos/Arbitrage/modules/FundingCostTracker.ts:10-11` documents being forced to index-access `CURRENT_FUNDING[12]`, `MARK_PRICE[15]`, `OPEN_INTEREST[18]`, `NEXT_FUNDING_EVT_MTS[8]`.
- No funding-ticker / funding-channel WS models covering what LendingBot decodes by hand.

**The bug-class precedent (git evidence):**
- ISS-059/060 (fixed 2026-03-17, `12639aea4`, `49591f56`): with `transform:true` the runtime value is an *object*, but code read array indices → **silent `undefined`** in money paths; fix introduced the `order.symbol ?? order[3]` fallback pattern across 15 files.
- `eed29a6c5`: wrong tuple index made retain-gains logic silently inert on a live bot.
- Precision family: `e83a6882` (rate **ticks vs basis points** — a 100× scaling fix), `bd83a36c`, `22b077df`.
- `BfxLendingBot/modules/exchange/Bitfinex.py:1102` still guesses units: `frr_rate * 100 if frr_rate < 0.001 else frr_rate`.

## §2 Verdict

**Complete and adopt `@cloudingenium/bfx-api-node-models` as the single Bitfinex positional decoder. Build nothing new.**

1. This repo is the source of truth: fill the flagged model gaps (PR-1), and every TS consumer decodes via model classes — never a bare `arr[n]` outside this library.
2. **Per-channel index truth table** (order / funding-offer / credit / loan / ledger / ticker / funding-ticker / status-deriv / position / trade) lives in this repo as normative documentation + test fixtures, cross-checked against the Bitfinex API docs at authoring time — the table IS the review artifact for every adoption PR.
3. Python side: `bfxapi` dataclasses stay where they already work; the raw-index residue (loans, ledgers, WS ticker channels) gets a small `modules/exchange/wire_decode.py` of **named index constants mirroring the same truth table** — a constants module, not a port of this library.
4. The MCP's private decoder (`jc-mcp-finanzas-bitfinex/src/bitfinex-client.ts`) folds onto this library and is deleted.
5. **No-money slice first**: this library + the MCP server carry zero deploy risk. Producer-side changes on the live bots merge behind the fences below.

## §3 Hazards + fences

- **F1 — no-money first.** PR-1/PR-2 (this library + MCP) are restart-free and land before any bot-side change.
- **F2 — live bots deploy only at a planned restart window.** BfxLendingBot (~$4M, `.runtime-pin=master`) and BfxPingPongBot runtime checkouts are never touched outside a restart window; coordinate with wire-contract PR-6's window (one restart, both arcs). Merging to the repo is allowed; *deployment* is the gated act.
- **F3 — keep the ISS-060 `named ?? arr[n]` fallback pattern during transition.** Runtime tuple-vs-object ambiguity (`transform:true`) is real and witnessed; hard-cutting to index-only or object-only reads re-opens ISS-059. Removal of fallbacks is a later, diagnostics-verified cleanup.
- **F4 — decoders return raw API units; scaling stays at call sites.** The 100× ticks-vs-basis-points precedent (`e83a6882`) says magnitude conversions hidden inside a decoder are how money bugs are made. Model fields carry the exchange's units, documented in the truth table; the `frr_rate` heuristic at `Bitfinex.py:1102` gets resolved by *documenting* the channel's actual unit, not by another guess.
- **F5 — fixture-tested against recorded payloads.** Every model completed/added in PR-1 gets recorded real-payload fixtures (sanitized), asserting field-by-field against the truth table — not synthetic arrays that encode the same assumption twice.
- **H1 — `StatusMessagesDeriv` field additions must not shift existing indices** (additive completion only); a consumer pinned to the old 9 fields must behave identically.

## §7 Exec queue (Sonnet sessions)

| PR | Repo | Scope |
|---|---|---|
| PR-1 | bfx-api-node-models | Complete `StatusMessagesDeriv` (14+ fields per FundingCostTracker's documented gap) + funding-ticker/funding-channel models + the per-channel index truth table doc + recorded-fixture tests (F5); publish |
| PR-2 | Knowledge-Hub | Fold `jc-mcp-finanzas-bitfinex/src/bitfinex-client.ts`'s ~126-site private decoder onto the models; delete the duplicate |
| PR-3 | BfxPingPongBot | No-money paths first: dashboard-api + monitoring/health decode sites (e.g. `MarketPriceService.ts:75 ticker[7]`) onto models, keeping F3 fallbacks |
| PR-4 | BfxPingPongBot | Strategy/core: centralize WS tuple decode in `WSv2Singleton.ts` behind named accessors; `BasisStrategy`/`PositionNettingService` index reads onto models (F3). **Deploy gated F2** |
| PR-5 | BfxLendingBot | `wire_decode.py` named index constants for loans/ledgers/WS tickers + resolve the `frr_rate` unit heuristic per F4. **Deploy gated F2** |

Each PR: read this doc first; the doc wins over the PR-row summary. The truth table (PR-1) is a merge prerequisite for PR-2→5.
