# Project Guidelines

> **Primary reference:** Read the repo's `CLAUDE.md` first — it is the single source of truth. This file provides supplementary Copilot-specific context.

## Build and Test

- Node ≥ 24, TypeScript ~6.0, ESM-only.
- `npm run build` — clean + `tsc` to `dist/`.
- `npm test` — builds, then runs the real suite: `node --test --experimental-test-coverage` over `test/**/*.test.ts`, with the coverage gate set to 100% lines/branches/functions. Tests are TypeScript and import the **built `dist/`**, never `src/` — zero test-framework deps, just Node 24's `node:test`/`node:assert`. Note the gate only measures files the suite loads, so it ratchets what is already covered and says nothing about the source files no test imports yet.
- `npm run lint` / `npm run lint:fix` — ESLint 9 + typescript-eslint.
- Published as `@cloudingenium/bfx-api-node-models` on GitHub Packages (internal visibility).

## Architecture

- TypeScript models for the Bitfinex API — CloudIngenium modernized fork.
- `src/model.ts` — base `Model` class (`serialize`, `unserialize`, `toJS`).
- `src/*.ts` — one file per Bitfinex data model (Order, Trade, Position, Wallet, etc.).
- `src/util/` — internal helpers (`isCollection`, `arrFillEmpty`, `assignFromCollectionOrInstance`).
- `src/validators/` — field validators (amount, price, date, symbol, etc.).
- `src/data/` — static data (symbols, currencies, wallet types).
- `src/types/` — ambient type declarations for untyped deps.

## Conventions

- ESM-only — never add CommonJS exports or `require()` calls.
- All deps pinned (no `^`, `*`, `latest`); dependabot manages updates.
- Validators are pure functions — no I/O, no async.
- Backward compat with the original Bitfinex `bfx-api-node-models` runtime shape is required (consumers depend on serialization order); changes that break that shape need a major version bump.
