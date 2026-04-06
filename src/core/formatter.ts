/**
 * Beancount format formatter.
 * Converts structured LedgerData back to plain-text beancount format.
 */

import { LedgerData, Directive, Transaction, Posting } from "../types";

/** Format a number with optional decimal places */
function formatAmount(amount: number, decimalPlaces: number = 0): string {
  if (decimalPlaces === 0 && Number.isInteger(amount)) {
    return amount.toLocaleString("en-US");
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

/** Format a single posting line */
function formatPosting(p: Posting, decimalPlaces: number): string {
  if (p.amount === null) {
    return `  ${p.account}`;
  }
  const cur = p.currency || "???";
  return `  ${p.account}  ${formatAmount(p.amount, decimalPlaces)} ${cur}`;
}

/** Format a transaction to beancount text */
function formatTransaction(txn: Transaction, decimalPlaces: number): string {
  const parts: string[] = [];

  // Header line
  let header = `${txn.date} ${txn.flag}`;
  if (txn.payee) {
    header += ` "${txn.payee}" "${txn.narration}"`;
  } else {
    header += ` "${txn.narration}"`;
  }

  // Tags and links
  for (const tag of txn.tags) {
    header += ` #${tag}`;
  }
  for (const link of txn.links) {
    header += ` ^${link}`;
  }

  parts.push(header);

  const txnMetaByPostingIndex = new Map<number, string[]>();
  if (txn.metadata) {
    for (const { entry: [key, value], postingIndex } of txn.metadata) {
      const existing = txnMetaByPostingIndex.get(postingIndex) || [];
      existing.push(`  ${key}: ${value}`);
      txnMetaByPostingIndex.set(postingIndex, existing);
    }
  }

  // Transaction-level metadata before the first posting
  for (const line of txnMetaByPostingIndex.get(0) || []) {
    parts.push(line);
  }

  // Postings with their metadata, plus transaction-level metadata between postings
  for (let i = 0; i < txn.postings.length; i++) {
    const p = txn.postings[i];
    parts.push(formatPosting(p, decimalPlaces));
    if (p.taxCategory) {
      parts.push(`    tax-category: ${p.taxCategory}`);
    }
    if (p.metadata) {
      for (const [key, value] of p.metadata) {
        parts.push(`    ${key}: ${value}`);
      }
    }
    for (const line of txnMetaByPostingIndex.get(i + 1) || []) {
      parts.push(line);
    }
  }

  return parts.join("\n");
}

/** Format a directive to beancount text */
function formatDirective(dir: Directive, decimalPlaces: number): string {
  switch (dir.type) {
    case "option":
      return `option "${dir.key}" "${dir.value}"`;
    case "open": {
      const currencies = dir.currencies.length > 0 ? " " + dir.currencies.join(",") : "";
      return `${dir.date} open ${dir.account}${currencies}`;
    }
    case "close":
      return `${dir.date} close ${dir.account}`;
    case "balance":
      return `${dir.date} balance ${dir.account} ${formatAmount(dir.amount, decimalPlaces)} ${dir.currency}`;
    case "pad":
      return `${dir.date} pad ${dir.account} ${dir.padAccount}`;
    case "commodity":
      return `${dir.date} commodity ${dir.currency}`;
    case "transaction":
      return formatTransaction(dir.data, decimalPlaces);
    case "comment":
      return dir.text;
  }
}

/** Format a complete ledger to beancount text */
export function format(ledger: LedgerData, decimalPlaces: number = 0): string {
  if (ledger.directives.length === 0) {
    return "\n";
  }

  return ledger.directives.map((dir) => formatDirective(dir, decimalPlaces)).join("\n") + "\n";
}
