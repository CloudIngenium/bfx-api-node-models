# bfx-api-node-models

TypeScript models for the Bitfinex API — CloudIngenium modernized fork.

## Stack

- **Runtime**: Node.js >= 24, TypeScript ~6.0, ESM-only
- **Build**: `tsc` -> `dist/`
- **Test**: `node --test 'test/**/*.test.ts'` against the **built `dist/`** (Node 24's native TS type-stripping only erases types — it does not resolve a `.js` import specifier to a sibling `.ts` file, and this repo's `NodeNext` resolution imports everything with a `.js` extension — so tests import compiled output, not `src/`). Zero test-framework dependencies: Node 24's built-in `node:test`/`node:assert` runner is sufficient, matching the repo's minimal-deps philosophy. Fixtures live in `test/fixtures/*.json` — recorded real (public, unauthenticated, no-money) Bitfinex payloads per the positional-decoder-adoption design doc's F5 fence, not synthetic arrays. See `docs/positional-index-truth-table.md` for the normative per-channel index reference these tests assert against.
- **Coverage**: `npm test` runs `--experimental-test-coverage` and fails below the `--test-coverage-lines/branches/functions` thresholds in the `test` script. `test/model-surface.test.ts` imports the package index, so every module is measured — an untested model counts as uncovered, not absent. Raise the thresholds as coverage grows; they are a floor, not a claim of full coverage.
- **Lint**: ESLint 10 + typescript-eslint (TypeScript 6 until the parser declares TS7 support)
- **Package**: `@cloudingenium/bfx-api-node-models` (GitHub Packages, internal visibility)

## Key Commands

```bash
npm run build    # Compile (tsc); postbuild runs scripts/check-dist.mjs
npm test         # Build + unit tests, enforcing the coverage gate
npm run lint     # ESLint check
npm run lint:fix # ESLint auto-fix
```

## Releasing

Push a `v<version>` tag matching `package.json`; `.github/workflows/publish.yml`
runs the full suite, refuses a tag whose version disagrees with the manifest,
and publishes to GitHub Packages. **Bump the version in the PR, tag after it
merges** — never publish by hand.

That workflow did not exist until 10.2.0: 10.0.0–10.1.1 were published manually,
so master could sit several merged PRs ahead of what consumers on `^10.1.1`
actually resolved, with nothing reporting the gap. If you add a feature here,
the job is not done when the PR merges — check
`npm view @cloudingenium/bfx-api-node-models version --registry=https://npm.pkg.github.com`
against `package.json`.

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
- Package must use `internal` visibility (not private) — private breaks GITHUB_TOKEN in CI
