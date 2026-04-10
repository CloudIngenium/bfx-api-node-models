# bfx-api-node-models

TypeScript models for the Bitfinex API — CloudIngenium modernized fork.

## Stack

- **Runtime**: Node.js >= 24, TypeScript ~6.0, ESM-only
- **Build**: `tsc` -> `dist/`
- **Test**: **None currently.** The original Bitfinex CJS test suite under `test/` was deleted during the TS migration cleanup — it was 50 orphan `.js` files that the mocha runner (`test/**/*.ts`) never picked up, depending on packages we no longer ship (`lodash`, `bfx-hf-util`, `bfx-api-node-rest` upstream, `bfx-api-node-util`). **TODO**: rewrite key model tests in TypeScript (`test/**/*.ts`) and re-add `mocha`, `c8`, `tsx`, `@types/mocha` to devDependencies. Until then, `npm test` is a no-op stub.
- **Lint**: ESLint 9 + typescript-eslint
- **Package**: `@cloudingenium/bfx-api-node-models` (GitHub Packages, internal visibility)

## Key Commands

```bash
npm run build    # Clean + compile
npm test         # Build + unit tests with coverage
npm run lint     # ESLint check
npm run lint:fix # ESLint auto-fix
```

## Architecture

- `src/model.ts` — Base Model class (serialize/unserialize/toJS)
- `src/*.ts` — One file per Bitfinex data model (Order, Trade, etc.)
- `src/util/` — Internal helpers (isCollection, arrFillEmpty, assignFromCollectionOrInstance)
- `src/validators/` — Field validators (amount, price, date, symbol, etc.)
- `src/data/` — Static data (symbols, currencies, wallet types)
- `src/types/` — Ambient type declarations for untyped deps

## Dependencies

- `bignumber.js` — arbitrary-precision arithmetic
- `crc-32` — CRC32 checksums for OrderBook verification

Precision helpers (`prepareAmount`, `preparePrice`) live in `src/util/precision.ts` —
do **not** re-introduce `bfx-api-node-util` as a runtime dep. It is CJS and breaks
Node 24 ESM named imports (caused the 10.0.0 publish bug). The `postbuild` guard at
`scripts/check-dist.mjs` will fail the build if any `dist/*.js` ever imports it again.

## Consumers

Used by `@cloudingenium/bfx-api-node-rest`, `BfxPingPongBot`, and `BotEventAggregator`.

## Gotchas

- All model constructors accept both array-format (API wire format) and object-format payloads
- `serialize-javascript` vuln in mocha's dep tree is dev-only and unfixable without mocha downgrade
- Package must use `internal` visibility (not private) — private breaks GITHUB_TOKEN in CI
