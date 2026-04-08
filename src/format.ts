/** Shared utilities: number formatting, currency, and ID generation. */

/** Generate a simple unique id */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatNum(n: number, decimals: number): string {
  if (decimals === 0 && Number.isInteger(n)) {
    return n.toLocaleString("en-US");
  }
  return n.toLocaleString("en-US", {
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
