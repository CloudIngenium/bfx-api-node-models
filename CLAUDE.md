# bfx-api-node-models

TypeScript models for the Bitfinex API — CloudIngenium modernized fork.

## Stack

- **Runtime**: Node.js >= 24, TypeScript ~6.0, ESM-only
- **Build**: `tsc` -> `dist/`
- **Test**: Mocha + c8 coverage (85% line/function/statement, 55% branch)
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

- `bfx-api-node-util` — Bitfinex utility functions
- `crc-32` — CRC32 checksums for OrderBook verification

## Consumers

Used by `@cloudingenium/bfx-api-node-rest`, `BfxPingPongBot`, and `BotEventAggregator`.

## Gotchas

- All model constructors accept both array-format (API wire format) and object-format payloads
- `serialize-javascript` vuln in mocha's dep tree is dev-only and unfixable without mocha downgrade
- Package must use `internal` visibility (not private) — private breaks GITHUB_TOKEN in CI
