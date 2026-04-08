export function stringValidator (v: unknown, validOptions?: string[]): string | null {
  return typeof v !== 'string' || (validOptions && !validOptions.includes(v))
    ? 'must be a string'
    : null
}
