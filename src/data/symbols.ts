const SYMBOL_LIST = [
  'tBTCUSD', 'tLTCUSD', 'tLTCBTC', 'tETHUSD', 'tETHBTC', 'tETCBTC', 'tETCUSD',
  'tRRTUSD', 'tRRTBTC', 'tZECUSD', 'tZECBTC', 'tXMRUSD', 'tXMRBTC', 'tDSHUSD',
  'tDSHBTC', 'tBTCEUR', 'tBTCJPY', 'tXRPUSD', 'tXRPBTC', 'tIOTUSD', 'tIOTBTC',
  'tIOTETH', 'tEOSUSD', 'tEOSBTC', 'tEOSETH', 'tSANUSD', 'tSANBTC', 'tSANETH',
  'tOMGUSD', 'tOMGBTC', 'tOMGETH', 'tBCHUSD', 'tBCHBTC', 'tBCHETH', 'tNEOUSD',
  'tNEOBTC', 'tNEOETH', 'tETPUSD', 'tETPBTC', 'tETPETH', 'tQTMUSD', 'tQTMBTC',
  'tQTMETH', 'tAVTUSD', 'tAVTBTC', 'tAVTETH', 'tEDOUSD', 'tEDOBTC', 'tEDOETH',
  'tBTGUSD', 'tBTGBTC', 'tDATUSD', 'tDATBTC', 'tDATETH', 'tQSHUSD', 'tQSHBTC',
  'tQSHETH', 'tYYWUSD', 'tYYWBTC', 'tYYWETH', 'tGNTUSD', 'tGNTBTC', 'tGNTETH',
  'tSNTUSD', 'tSNTBTC', 'tSNTETH', 'tIOTEUR', 'tBATUSD', 'tBATBTC', 'tBATETH',
  'tMNAUSD', 'tMNABTC', 'tMNAETH', 'tFUNUSD', 'tFUNBTC', 'tFUNETH', 'tZRXUSD',
  'tZRXBTC', 'tZRXETH', 'tTNBUSD', 'tTNBBTC', 'tTNBETH', 'tSPKUSD', 'tSPKBTC',
  'tSPKETH', 'tTRXUSD', 'tTRXBTC', 'tTRXETH', 'tRCNUSD', 'tRCNBTC', 'tRCNETH',
  'tRLCUSD', 'tRLCBTC', 'tRLCETH', 'tAIDUSD', 'tAIDBTC', 'tAIDETH', 'tSNGUSD',
  'tSNGBTC', 'tSNGETH', 'tREPUSD', 'tREPBTC', 'tREPETH', 'tELFUSD', 'tELFBTC',
  'tELFETH', 'tBTCGBP', 'tETHEUR', 'tETHJPY', 'tETHGBP', 'tNEOEUR', 'tNEOJPY',
  'tNEOGBP', 'tEOSEUR', 'tEOSJPY', 'tEOSGBP', 'tIOTJPY', 'tIOTGBP', 'tIOSUSD',
  'tIOSBTC', 'tIOSETH', 'tAIOUSD', 'tAIOBTC', 'tAIOETH', 'tREQUSD', 'tREQBTC',
  'tREQETH', 'tRDNUSD', 'tRDNBTC', 'tRDNETH', 'tLRCUSD', 'tLRCBTC', 'tLRCETH',
  'tWAXUSD', 'tWAXBTC', 'tWAXETH', 'tDAIUSD', 'tDAIBTC', 'tDAIETH', 'tCFIUSD',
  'tCFIBTC', 'tCFIETH', 'tAGIUSD', 'tAGIBTC', 'tAGIETH', 'tBFTUSD', 'tBFTBTC',
  'tBFTETH', 'tMTNUSD', 'tMTNBTC', 'tMTNETH', 'tODEUSD', 'tODEBTC', 'tODEETH',
  'tANTUSD', 'tANTBTC', 'tANTETH', 'tDTHUSD', 'tDTHBTC', 'tDTHETH', 'tMITUSD',
  'tMITBTC', 'tMITETH', 'tSTJUSD', 'tSTJBTC', 'tSTJETH', 'tXLMUSD', 'tXLMEUR',
  'tXLMJPY', 'tXLMGBP', 'tXLMBTC', 'tXLMETH', 'tXVGUSD', 'tXVGEUR', 'tXVGJPY',
  'tXVGGBP', 'tXVGBTC', 'tXVGETH', 'tBCIUSD', 'tBCIBTC', 'tMKRUSD', 'tMKRBTC',
  'tMKRETH', 'tVENUSD', 'tVENBTC', 'tVENETH', 'tKNCUSD', 'tKNCBTC', 'tKNCETH',
  'tPOAUSD', 'tPOABTC', 'tPOAETH', 'tLEOUSD'
]

/**
 * Legacy snapshot of 193 trading pairs, keyed `BASE_QUOTE` (`SYMBOLS.BTC_USD`
 * is `'tBTCUSD'`), frozen around tLEOUSD.
 *
 * @deprecated Not a list of what Bitfinex trades today, and no validator
 * reads it any more: `symbolValidator` checks the symbol FORMAT. Kept, and
 * kept frozen, because it is a public export: refreshing it would drop the
 * keys of delisted pairs (a breaking removal), and its `BASE_QUOTE` key
 * derivation cannot express separated pairs (tAVAX:USD would key as
 * `AVA_X:USD`). For the live list, read the public
 * `conf/pub:list:pair:exchange` endpoint.
 */
export const SYMBOLS: Record<string, string> = {}

for (const sym of SYMBOL_LIST) {
  SYMBOLS[`${sym.substring(1, 4)}_${sym.substring(4)}`] = sym
}
