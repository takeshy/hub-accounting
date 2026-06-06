/**
 * Completion: collect candidates from ledger for autocomplete.
 * Based on beancount-lsp's completion logic.
 */

import { LedgerData, Transaction, Account } from "../types";

/** Completion candidate with metadata */
export interface CompletionCandidate {
  label: string;
  kind: "account" | "currency" | "tag" | "link" | "payee" | "narration" | "metadata-key";
  detail?: string;
  count?: number;
}

/** Collect all open account names */
export function collectAccounts(ledger: LedgerData): CompletionCandidate[] {
  return ledger.accounts
    .filter((a) => !a.closeDate)
    .map((a) => ({
      label: a.name,
      kind: "account" as const,
      detail: a.type,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Collect all currencies from accounts and commodities */
export function collectCurrencies(ledger: LedgerData): CompletionCandidate[] {
  const seen = new Set<string>();

  for (const acc of ledger.accounts) {
    for (const cur of acc.currencies) {
      seen.add(cur);
    }
  }

  for (const dir of ledger.directives) {
    if (dir.type === "commodity") {
      seen.add(dir.currency);
    }
  }

  return Array.from(seen)
    .map((c) => ({ label: c, kind: "currency" as const }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Collect all tags from transactions */
export function collectTags(ledger: LedgerData): CompletionCandidate[] {
  const counts = new Map<string, number>();

  for (const txn of ledger.transactions) {
    for (const tag of txn.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, kind: "tag" as const, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label));
}

/** Collect all links from transactions */
export function collectLinks(ledger: LedgerData): CompletionCandidate[] {
  const counts = new Map<string, number>();

  for (const txn of ledger.transactions) {
    for (const link of txn.links) {
      counts.set(link, (counts.get(link) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, kind: "link" as const, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label));
}

/** Ranked payee/narration candidate */
interface RankedString {
  label: string;
  group: number;
  count: number;
  roles: "payee" | "narration" | "both";
}

/** Collect payees with frequency ranking */
export function collectPayees(ledger: LedgerData): CompletionCandidate[] {
  const counts = new Map<string, number>();

  for (const txn of ledger.transactions) {
    if (txn.payee) {
      counts.set(txn.payee, (counts.get(txn.payee) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, kind: "payee" as const, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label));
}

/** Collect narrations with frequency ranking */
export function collectNarrations(ledger: LedgerData, payeeFilter?: string): CompletionCandidate[] {
  const counts = new Map<string, number>();

  for (const txn of ledger.transactions) {
    if (payeeFilter && txn.payee !== payeeFilter) continue;
    if (txn.narration) {
      counts.set(txn.narration, (counts.get(txn.narration) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, kind: "narration" as const, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label));
}

/** Collect metadata keys with frequency ranking */
export function collectMetadataKeys(ledger: LedgerData): CompletionCandidate[] {
  const counts = new Map<string, number>();

  for (const txn of ledger.transactions) {
    if (txn.metadata) {
      for (const { entry } of txn.metadata) {
        counts.set(entry[0], (counts.get(entry[0]) || 0) + 1);
      }
    }
    for (const p of txn.postings) {
      if (p.metadata) {
        for (const [key] of p.metadata) {
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, kind: "metadata-key" as const, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label));
}

/** Filter candidates by prefix (case-insensitive) */
export function filterCandidates(
  candidates: CompletionCandidate[],
  prefix: string
): CompletionCandidate[] {
  if (!prefix) return candidates;
  const lower = prefix.toLowerCase();
  return candidates.filter((c) => c.label.toLowerCase().startsWith(lower));
}

/** Get all completion candidates for a given context */
export function getCompletionCandidates(
  ledger: LedgerData,
  context: "account" | "currency" | "tag" | "link" | "payee" | "narration" | "metadata-key",
  prefix?: string,
  payeeFilter?: string
): CompletionCandidate[] {
  let candidates: CompletionCandidate[];

  switch (context) {
    case "account":
      candidates = collectAccounts(ledger);
      break;
    case "currency":
      candidates = collectCurrencies(ledger);
      break;
    case "tag":
      candidates = collectTags(ledger);
      break;
    case "link":
      candidates = collectLinks(ledger);
      break;
    case "payee":
      candidates = collectPayees(ledger);
      break;
    case "narration":
      candidates = collectNarrations(ledger, payeeFilter);
      break;
    case "metadata-key":
      candidates = collectMetadataKeys(ledger);
      break;
    default:
      candidates = [];
  }

  return prefix ? filterCandidates(candidates, prefix) : candidates;
}
