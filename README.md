# @cloudingenium/bfx-api-node-models

TypeScript models for the Bitfinex API — CloudIngenium modernized fork.

> Forked from [bitfinexcom/bfx-api-node-models](https://github.com/bitfinexcom/bfx-api-node-models) and fully rewritten in TypeScript ESM (v10.0.0).

## Overview

Model classes for working with Bitfinex REST & WebSocket API data structures. Models can be initialized with array-format payloads as returned by the API, and serialized back to array format when needed.

Some models (e.g., `Order`, `OrderBook`) provide higher-level methods that operate on the underlying data.

All models provide `serialize()` and `unserialize()` methods, plus a `toJS()` helper for converting to plain objects.

## Models

Alert, AccountSummary, AuthPermission, BalanceInfo, Candle, ChangeLog, CoreSettings, Currency, FundingCredit, FundingInfo, FundingLoan, FundingOffer, FundingTicker, FundingTickerHist, FundingTrade, Invoice, LedgerEntry, Liquidations, Login, MarginInfo, Model (base), Movement, MovementInfo, Notification, Order, OrderBook, Position, PublicTrade, StatusMessagesDeriv, SymbolDetails, Trade, TradingTicker, TradingTickerHist, TransactionFee, UserInfo, Wallet, WalletHist, WeightedAverages

## Installation

```bash
npm install @cloudingenium/bfx-api-node-models
```

## Usage

```typescript
import { Order } from '@cloudingenium/bfx-api-node-models'

const o = new Order({
  cid: Date.now(),
  symbol: 'tBTCUSD',
  price: 7000.0,
  amount: -0.02,
  type: Order.type.EXCHANGE_LIMIT,
})

// Generate an API-compatible new order packet
console.log(o.toNewOrderPacket())
```

## Development

```bash
npm ci          # Install dependencies
npm run build   # Compile TypeScript
npm test        # Build + run tests with coverage
npm run lint    # ESLint
```

Requires Node.js >= 24.0.0 and TypeScript ~6.0.

## License

MIT
