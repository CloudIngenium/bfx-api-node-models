export function isCollection (data: unknown): data is unknown[][] {
  return Array.isArray(data) && data.length > 0 &&
    (Array.isArray(data[0]) || (typeof data[0] === 'object' && data[0] !== null))
}
