declare module 'bfx-api-node-util' {
  export function prepareAmount (amount: number | string): string
  export function preparePrice (price: number | string): string
  export function nonce (): string
  export function genAuthSig (secret: string, payload: string): { sig: string }
  export function setSigFig (number: number, maxSigs?: number): string
  export function setPrecision (number: number, decimals?: number): string
  export function isSnapshot (msg: unknown): boolean
  export function isClass (f: unknown): boolean
}
