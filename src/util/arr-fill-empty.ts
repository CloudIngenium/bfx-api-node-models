export function arrFillEmpty (arr: unknown[], fill: unknown = null): void {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === undefined) {
      arr[i] = fill
    }
    if (Array.isArray(arr[i])) {
      arrFillEmpty(arr[i] as unknown[], fill)
    }
  }
}
