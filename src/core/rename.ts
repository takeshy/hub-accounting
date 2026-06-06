/**
 * Rename: batch rename accounts, tags, and links across the ledger.
 * Based on beancount-lsp's rename logic with hierarchical account support.
 */

import { LedgerData, Transaction, Directive, Account } from "../types";
import { refreshErrors } from "./ledger";

/** Rename target type */
export type RenameTarget = "account" | "tag" | "link" | "currency";

/** Result of a rename operation */
export interface RenameResult {
  ledger: LedgerData;
  changedCount: number;
}

function ensureUnique(values: string[], kind: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Rename would create duplicate ${kind}: ${value}`);
    }
    seen.add(value);
  }
}

function collectCurrencyNames(ledger: LedgerData): Set<string> {
  const currencies = new Set<string>();
  for (const acc of ledger.accounts) {
    for (const cur of acc.currencies) currencies.add(cur);
  }
  for (const txn of ledger.transactions) {
    for (const p of txn.postings) currencies.add(p.currency);
  }
  for (const dir of ledger.directives) {
    switch (dir.type) {
      case "open":
        for (const cur of dir.currencies) currencies.add(cur);
        break;
      case "balance":
      case "commodity":
        currencies.add(dir.currency);
        break;
      case "price":
        currencies.add(dir.currency);
        currencies.add(dir.targetCurrency);
        break;
      case "transaction":
        for (const p of dir.data.postings) currencies.add(p.currency);
        break;
    }
  }
  return currencies;
}

/**
 * Validate a new account name.
 * Must start with a valid account type and use valid characters.
 */
export function isValidAccountName(name: string): boolean {
  const parts = name.split(":");
  if (parts.length < 2) return false;

  const validTypes = ["Assets", "Liabilities", "Income", "Expenses", "Equity"];
  if (!validTypes.includes(parts[0])) return false;

  for (const part of parts) {
    if (!part) return false;
    if (!/^[A-Z][A-Za-z0-9_-]*$/.test(part)) return false;
  }
  return true;
}

/**
 * Validate a new tag or link name.
 * Must be alphanumeric with hyphens, underscores, dots.
 */
export function isValidTagLinkName(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name);
}

/**
 * Validate a new currency name.
 * Must be uppercase letters and digits, starting with a letter.
 */
export function isValidCurrencyName(name: string): boolean {
  return /^[A-Z][A-Z0-9]*$/.test(name);
}

/**
 * Validate a new name for the given target type.
 */
export function isValidNewName(target: RenameTarget, name: string): boolean {
  switch (target) {
    case "account":
      return isValidAccountName(name);
    case "tag":
    case "link":
      return isValidTagLinkName(name);
    case "currency":
      return isValidCurrencyName(name);
    default:
      return false;
  }
}

/**
 * Rename an account across all transactions and directives.
 * Supports hierarchical rename: renaming "Assets:Bank" to "Assets:Savings"
 * also renames "Assets:Bank:Checking" to "Assets:Savings:Checking".
 */
export function renameAccount(
  ledger: LedgerData,
  oldName: string,
  newName: string
): RenameResult {
  if (!isValidAccountName(newName)) {
    throw new Error(`Invalid account name: ${newName}`);
  }

  let changedCount = 0;

  const replaceAccount = (name: string): string => {
    if (name === oldName) {
      return newName;
    }
    if (name.startsWith(oldName + ":")) {
      return newName + name.slice(oldName.length);
    }
    return name;
  };

  ensureUnique(ledger.accounts.map((acc) => replaceAccount(acc.name)), "account");

  const countAccountChange = (name: string): string => {
    const replaced = replaceAccount(name);
    if (replaced !== name) changedCount++;
    return replaced;
  };

  const newTransactions: Transaction[] = ledger.transactions.map((txn) => {
    const newPostings = txn.postings.map((p) => ({
      ...p,
      account: replaceAccount(p.account),
    }));
    return { ...txn, postings: newPostings };
  });

  const newDirectives: Directive[] = ledger.directives.map((dir) => {
    switch (dir.type) {
      case "open":
        return { ...dir, account: countAccountChange(dir.account) };
      case "close":
        return { ...dir, account: countAccountChange(dir.account) };
      case "balance":
        return { ...dir, account: countAccountChange(dir.account) };
      case "pad":
        return {
          ...dir,
          account: countAccountChange(dir.account),
          padAccount: countAccountChange(dir.padAccount),
        };
      case "note":
        return { ...dir, account: countAccountChange(dir.account) };
      case "transaction":
        const txn = dir.data;
        const newPostings = txn.postings.map((p) => ({
          ...p,
          account: countAccountChange(p.account),
        }));
        return { ...dir, data: { ...txn, postings: newPostings } };
      default:
        return dir;
    }
  });

  const newAccounts: Account[] = ledger.accounts.map((acc) => ({
    ...acc,
    name: replaceAccount(acc.name),
    type: replaceAccount(acc.name).split(":")[0] as Account["type"],
  }));

  return {
    ledger: refreshErrors({
      ...ledger,
      transactions: newTransactions,
      directives: newDirectives,
      accounts: newAccounts,
    }),
    changedCount,
  };
}

/**
 * Rename a tag across all transactions.
 */
export function renameTag(
  ledger: LedgerData,
  oldName: string,
  newName: string
): RenameResult {
  if (!isValidTagLinkName(newName)) {
    throw new Error(`Invalid tag name: ${newName}`);
  }

  let changedCount = 0;
  if (
    oldName !== newName &&
    ledger.transactions.some((txn) => txn.tags.includes(oldName)) &&
    ledger.transactions.some((txn) => txn.tags.includes(newName))
  ) {
    throw new Error(`Rename would create duplicate tag: ${newName}`);
  }

  const newTransactions: Transaction[] = ledger.transactions.map((txn) => {
    const newTags = txn.tags.map((tag) => (tag === oldName ? newName : tag));
    return { ...txn, tags: newTags };
  });

  const newDirectives: Directive[] = ledger.directives.map((dir) => {
    if (dir.type === "transaction") {
      const txn = dir.data;
      const newTags = txn.tags.map((tag) => {
        if (tag === oldName) {
          changedCount++;
          return newName;
        }
        return tag;
      });
      return { ...dir, data: { ...txn, tags: newTags } };
    }
    return dir;
  });

  return {
    ledger: refreshErrors({
      ...ledger,
      transactions: newTransactions,
      directives: newDirectives,
    }),
    changedCount,
  };
}

/**
 * Rename a link across all transactions.
 */
export function renameLink(
  ledger: LedgerData,
  oldName: string,
  newName: string
): RenameResult {
  if (!isValidTagLinkName(newName)) {
    throw new Error(`Invalid link name: ${newName}`);
  }

  let changedCount = 0;
  if (
    oldName !== newName &&
    ledger.transactions.some((txn) => txn.links.includes(oldName)) &&
    ledger.transactions.some((txn) => txn.links.includes(newName))
  ) {
    throw new Error(`Rename would create duplicate link: ${newName}`);
  }

  const newTransactions: Transaction[] = ledger.transactions.map((txn) => {
    const newLinks = txn.links.map((link) => (link === oldName ? newName : link));
    return { ...txn, links: newLinks };
  });

  const newDirectives: Directive[] = ledger.directives.map((dir) => {
    if (dir.type === "transaction") {
      const txn = dir.data;
      const newLinks = txn.links.map((link) => {
        if (link === oldName) {
          changedCount++;
          return newName;
        }
        return link;
      });
      return { ...dir, data: { ...txn, links: newLinks } };
    }
    return dir;
  });

  return {
    ledger: refreshErrors({
      ...ledger,
      transactions: newTransactions,
      directives: newDirectives,
    }),
    changedCount,
  };
}

/**
 * Rename a currency across all accounts, postings, and directives.
 */
export function renameCurrency(
  ledger: LedgerData,
  oldName: string,
  newName: string
): RenameResult {
  if (!isValidCurrencyName(newName)) {
    throw new Error(`Invalid currency name: ${newName}`);
  }

  let changedCount = 0;
  const currencyNames = collectCurrencyNames(ledger);
  if (oldName !== newName && currencyNames.has(oldName) && currencyNames.has(newName)) {
    throw new Error(`Rename would merge existing currency: ${newName}`);
  }

  const replaceCurrency = (cur: string): string => {
    if (cur === oldName) {
      return newName;
    }
    return cur;
  };

  const countCurrencyChange = (cur: string): string => {
    const replaced = replaceCurrency(cur);
    if (replaced !== cur) changedCount++;
    return replaced;
  };

  const newTransactions: Transaction[] = ledger.transactions.map((txn) => {
    const newPostings = txn.postings.map((p) => ({
      ...p,
      currency: replaceCurrency(p.currency),
    }));
    return { ...txn, postings: newPostings };
  });

  const newDirectives: Directive[] = ledger.directives.map((dir) => {
    switch (dir.type) {
      case "open":
        return { ...dir, currencies: dir.currencies.map(countCurrencyChange) };
      case "balance":
        return { ...dir, currency: countCurrencyChange(dir.currency) };
      case "commodity":
        return { ...dir, currency: countCurrencyChange(dir.currency) };
      case "price":
        return {
          ...dir,
          currency: countCurrencyChange(dir.currency),
          targetCurrency: countCurrencyChange(dir.targetCurrency),
        };
      case "transaction":
        const txn = dir.data;
        const newPostings = txn.postings.map((p) => ({
          ...p,
          currency: countCurrencyChange(p.currency),
        }));
        return { ...dir, data: { ...txn, postings: newPostings } };
      default:
        return dir;
    }
  });

  const newAccounts: Account[] = ledger.accounts.map((acc) => ({
    ...acc,
    currencies: acc.currencies.map(replaceCurrency),
  }));

  return {
    ledger: refreshErrors({
      ...ledger,
      transactions: newTransactions,
      directives: newDirectives,
      accounts: newAccounts,
    }),
    changedCount,
  };
}

/**
 * Unified rename function.
 */
export function rename(
  ledger: LedgerData,
  target: RenameTarget,
  oldName: string,
  newName: string
): RenameResult {
  switch (target) {
    case "account":
      return renameAccount(ledger, oldName, newName);
    case "tag":
      return renameTag(ledger, oldName, newName);
    case "link":
      return renameLink(ledger, oldName, newName);
    case "currency":
      return renameCurrency(ledger, oldName, newName);
    default:
      throw new Error(`Unknown rename target: ${target}`);
  }
}
