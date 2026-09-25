# bfx-api-node-models

TypeScript models for the Bitfinex API — CloudIngenium modernized fork.

## Stack

- **Runtime**: Node.js >= 24, TypeScript ~6.0, ESM-only
- **Build**: `tsc` -> `dist/`
- **Test**: `node --test 'test/**/*.test.ts'` against the **built `dist/`** (Node 24's native TS type-stripping only erases types — it does not resolve a `.js` import specifier to a sibling `.ts` file, and this repo's `NodeNext` resolution imports everything with a `.js` extension — so tests import compiled output, not `src/`). Zero test-framework dependencies: Node 24's built-in `node:test`/`node:assert` runner is sufficient, matching the repo's minimal-deps philosophy. Fixtures live in `test/fixtures/*.json` — recorded real (public, unauthenticated, no-money) Bitfinex payloads per the positional-decoder-adoption design doc's F5 fence, not synthetic arrays. See `docs/positional-index-truth-table.md` for the normative per-channel index reference these tests assert against.
- **Coverage**: `npm test` runs `--experimental-test-coverage` and **fails** below `--test-coverage-lines/branches/functions=95`. Read that number precisely: Node only instruments files the suite actually **loads**, so it measures the modules under test (`model`, `util/*`, `validators/*`, the ticker models) and is blind to the ~40 source files no test imports yet — an untested model contributes nothing rather than a zero. The measured set currently sits at **100/100/100**; the gate is deliberately 5 points below it. At exactly 100 the gate creates a perverse incentive: a *partial* test for a new model pulls that file into the measured set, drops the aggregate and breaks the build, while writing **no** test for it is free. The headroom makes the honest increment cheaper than the omission. Raising coverage of the *untested* files is the open work; the gate is a floor under what is already covered, not a claim that the package is fully tested.
- **Lint**: ESLint 10 + typescript-eslint (TypeScript 6 until the parser declares TS7 support)
- **Package**: `@cloudingenium/bfx-api-node-models` (GitHub Packages, internal visibility)

## Key Commands

```bash
npm run build    # Clean + compile
npm test         # Build + unit tests, enforcing the coverage gate (95/95/95)
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
