/** Shared number formatting utilities. */

export function formatNum(n: number, decimals: number): string {
  if (decimals === 0 && Number.isInteger(n)) {
    return n.toLocaleString();
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
