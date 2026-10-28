# Order book checksums

What `OrderBook#checksum()` and `OrderBook.checksumArr()` reproduce, and how far
that is proven. Evidence: `test/order-book-checksum.test.ts`, which replays the
recorded public session in `test/recordings/order-book-checksum.json` (book P0,
len 25, OB_CHECKSUM conf flag, recorded 2026-10-28).

## The string

CRC32 of the top 25 levels per side, interleaved bid, ask, bid, ask…, each level
as `key:amount`, all joined with `:`. Values are in JS string form: `9.7e-7`
stays `9.7e-7`. Until 2026-10-28 prices were rewritten to fixed point
(`0.00000097`, and `1e-7` became `0.00000010`), so every book quoting below
1e-6 failed every checksum (tDOGE:BTC 0/16, tADABTC 0/21 on the recording).

| Book | Key | Amount |
|---|---|---|
| Trading, P0..P4 `[PRICE, COUNT, AMOUNT]` | price, through `preparePrice` | AMOUNT |
| Funding, P0..P4 `[RATE, PERIOD, COUNT, AMOUNT]` | rate, unrounded | AMOUNT |
| Raw, R0 (trading or funding) | order or offer id | AMOUNT |

## Funding books: the order is the server's

An aggregated funding level is `(rate, period)`: one rate carries a separate
level per period. The server checksums levels that share a rate in an order no
field sorts (fUST 0.00012 arrived as periods 120, 2, 30, 20). What reproduces
it on the recording, 53 of 53 checksums across nine currencies:

1. Keep the snapshot's rows in the order served.
2. Update an existing `(rate, period)` in place.
3. Insert a new `(rate, period)` after the levels already at that rate.

`updateWith` and `updateArrayOBWith` follow these rules. Re-sorting a funding
book, or building one from a REST snapshot (a different moment, possibly a
different order), voids them.

## Limits

- The rule is inferred from one recorded session of a few minutes, not from
  Bitfinex documentation. It held for every funding checksum in it; nothing
  proves it holds for every book or every server.
- Treat a funding mismatch as a reason to resubscribe, not as proof that the
  book was corrupt: a tie-order disagreement looks the same as a lost update.
- Re-record and re-run the replay test before relying on this after a Bitfinex
  change to the book channel.
