export function numberValidator (v: unknown): string | null {
  return !Number.isFinite(v as number) ? 'must be a number' : null
}
