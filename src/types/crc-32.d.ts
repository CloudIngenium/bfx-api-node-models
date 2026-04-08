declare module 'crc-32' {
  export function str (data: string): number
  export function buf (data: Uint8Array): number
}
