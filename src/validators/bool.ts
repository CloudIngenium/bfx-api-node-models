export function boolValidator (v: unknown): string | null {
  return typeof v !== 'boolean' ? 'must be a bool' : null
}
