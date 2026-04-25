# Project Guidelines

> **Primary reference:** Read the repo's `CLAUDE.md` first — it is the single source of truth. This file provides supplementary Copilot-specific context.

## Build and Test

- Node ≥ 24, TypeScript ~6.0, ESM-only.
- `npm run build` — clean + `tsc` to `dist/`.
- `npm test` — currently a no-op stub. The original Bitfinex CJS test suite was removed during TS migration; tests need to be rewritten in TypeScript (`test/**/*.ts`) with `mocha`/`c8`/`tsx`/`@types/mocha` re-added to devDependencies. **Do not assume `npm test` validates anything until rewrites land.**
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
