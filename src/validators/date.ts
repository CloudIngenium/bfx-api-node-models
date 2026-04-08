export function dateValidator (v: unknown): string | null {
  return !Number.isFinite(+(v as number)) || +(v as number) < 0
    ? 'must be a date or positive number'
    : null
}
