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

const CURRENCY_SYMBOLS: Record<string, string> = {
  JPY: "円",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Display label for a currency code (e.g. "JPY" → "円") */
export function currencyLabel(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}
