// exchange, margin and funding are the wallet types Bitfinex serves today
// (docs.bitfinex.com/reference/rest-auth-wallets). trading and deposit are
// the legacy names; they stay because WalletHist.type exposes them.
export const WALLET_TYPES = ['exchange', 'margin', 'funding', 'trading', 'deposit'] as const
