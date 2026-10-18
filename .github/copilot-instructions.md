# Project Guidelines

> **Primary reference:** Read the repo's `CLAUDE.md` first — it is the single source of truth. This file provides supplementary Copilot-specific context.

## Build and Test

- Node ≥ 24, TypeScript ~7.0, ESM-only.
- `npm run build` — clean + `tsc` to `dist/`.
- `npm test` — builds, then runs the real suite: `node --test --experimental-test-coverage` over `test/**/*.test.ts`, failing below the `--test-coverage-lines/branches/functions` floors in the `test` script. Tests are TypeScript and import the **built `dist/`**, never `src/` — zero test-framework deps, just Node 24's `node:test`/`node:assert`. `test/model-surface.test.ts` imports the package index, so every module is measured.
- `npm run lint` / `npm run lint:fix` — oxlint (`.oxlintrc.json`, `@cloudingenium/oxlint-config`), type-aware through oxlint-tsgolint.
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
