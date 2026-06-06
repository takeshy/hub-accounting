/**
 * Hover: get detailed info for accounts and currencies.
 * Based on beancount-lsp's hover logic.
 */

import { LedgerData, Account, Directive } from "../types";

/** Account hover info */
export interface AccountHoverInfo {
  name: string;
  type: string;
  openDate: string;
  closeDate?: string;
  currencies: string[];
  metadata?: Record<string, string>;
}

/** Currency/commodity hover info */
export interface CurrencyHoverInfo {
  currency: string;
  latestPrice?: {
    amount: number;
    targetCurrency: string;
    date: string;
  };
  metadata?: Record<string, string>;
}

/** Get hover info for an account */
export function getAccountHoverInfo(
  ledger: LedgerData,
  accountName: string
): AccountHoverInfo | null {
  const account = ledger.accounts.find((a) => a.name === accountName);
  if (!account) return null;

  const metadata: Record<string, string> = {};

  for (const dir of ledger.directives) {
    if (dir.type === "open" && dir.account === accountName) {
      break;
    }
  }

  return {
    name: account.name,
    type: account.type,
    openDate: account.openDate,
    closeDate: account.closeDate,
    currencies: account.currencies,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/** Get hover info for a currency */
export function getCurrencyHoverInfo(
  ledger: LedgerData,
  currency: string,
  contextDate?: string
): CurrencyHoverInfo | null {
  const refDate = contextDate || new Date().toISOString().slice(0, 10);

  let hasCommodity = false;
  const metadata: Record<string, string> = {};

  for (const dir of ledger.directives) {
    if (dir.type === "commodity" && dir.currency === currency) {
      hasCommodity = true;
    }
  }

  let latestPrice: CurrencyHoverInfo["latestPrice"] | undefined;

  for (const dir of ledger.directives) {
    if (dir.type === "price" && dir.currency === currency && dir.date <= refDate) {
      if (!latestPrice || dir.date > latestPrice.date) {
        latestPrice = {
          amount: dir.amount,
          targetCurrency: dir.targetCurrency,
          date: dir.date,
        };
      }
    }
  }

  if (!hasCommodity && !latestPrice) return null;

  return {
    currency,
    latestPrice,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/** Format account hover info as plain text for tooltip display */
export function formatAccountHover(info: AccountHoverInfo): string {
  const lines: string[] = [];
  lines.push(`${info.name} (${info.type})`);
  lines.push("");
  lines.push(`Opened: ${info.openDate}`);
  if (info.closeDate) {
    lines.push(`Closed: ${info.closeDate}`);
  }
  if (info.currencies.length > 0) {
    lines.push(`Currencies: ${info.currencies.join(", ")}`);
  }
  if (info.metadata) {
    lines.push("");
    lines.push("Metadata");
    for (const [key, value] of Object.entries(info.metadata)) {
      lines.push(`- ${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

/** Format currency hover info as plain text for tooltip display */
export function formatCurrencyHover(
  info: CurrencyHoverInfo,
  contextDate: string
): string {
  const lines: string[] = [];
  lines.push(`${info.currency} (commodity)`);
  lines.push("");

  if (info.latestPrice) {
    lines.push(
      `As of ${contextDate}: ${info.latestPrice.amount} ${info.latestPrice.targetCurrency} (price from ${info.latestPrice.date})`
    );
  } else {
    lines.push(`No price recorded as of ${contextDate}.`);
  }

  if (info.metadata) {
    lines.push("");
    lines.push("Metadata");
    for (const [key, value] of Object.entries(info.metadata)) {
      lines.push(`- ${key}: ${value}`);
    }
  }
  return lines.join("\n");
}
