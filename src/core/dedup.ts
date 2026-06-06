/**
 * Transaction deduplication.
 * Detects equivalent transactions to prevent double-importing.
 *
 * Based on go-beancount's pkg/distribute/dedup:
 * Two transactions are equivalent when their date, postings (account + amount + currency),
 * and normalized free-text fields (payee, narration) match.
 * Metadata-key equality provides an escape hatch for stable import IDs.
 */

import { Transaction, LedgerData } from "../types";

/** Normalize free-text for comparison: NFKC + collapse whitespace */
function normalizeText(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Build a fingerprint string for a transaction's structural identity */
function txnFingerprint(txn: Transaction): string {
  const postings = txn.postings
    .map((p) => `${p.account}:${p.amount ?? ""}:${p.currency}`)
    .sort()
    .join("|");
  const payee = normalizeText(txn.payee ?? "");
  const narration = normalizeText(txn.narration);
  return `${txn.date}::${payee}::${narration}::${postings}`;
}

/** Build a set of fingerprints from existing transactions */
function buildFingerprintIndex(txns: Transaction[]): Set<string> {
  const set = new Set<string>();
  for (const txn of txns) {
    set.add(txnFingerprint(txn));
  }
  return set;
}

/** Build a set of metadata-key values from existing transactions */
function buildMetaKeyIndex(txns: Transaction[], keys: string[]): Set<string> {
  const set = new Set<string>();
  for (const txn of txns) {
    for (const key of keys) {
      const val = getMetadataValue(txn, key);
      if (val) {
        set.add(`${key}=${val}`);
      }
    }
  }
  return set;
}

/** Get a metadata value from transaction-level or posting-level metadata */
function getMetadataValue(txn: Transaction, key: string): string | null {
  if (txn.metadata) {
    for (const { entry } of txn.metadata) {
      if (entry[0] === key) return entry[1];
    }
  }
  for (const p of txn.postings) {
    if (p.metadata) {
      for (const [k, v] of p.metadata) {
        if (k === key) return v;
      }
    }
  }
  return null;
}

/** Match result for a single candidate transaction */
export interface DedupResult {
  /** Whether this transaction is a duplicate */
  isDuplicate: boolean;
  /** How the match was determined: "fingerprint" | "meta-key" | null */
  matchKind: "fingerprint" | "meta-key" | null;
}

/**
 * Check a list of candidate transactions against existing ledger transactions.
 * Returns a DedupResult for each candidate.
 *
 * @param existing - Transactions already in the ledger
 * @param candidates - Transactions to check for duplicates
 * @param eqMetaKeys - Optional metadata keys for equivalence matching (e.g., ["import-id"])
 */
export function checkDuplicates(
  existing: Transaction[],
  candidates: Transaction[],
  eqMetaKeys: string[] = []
): DedupResult[] {
  const fpIndex = buildFingerprintIndex(existing);
  const metaIndex = eqMetaKeys.length > 0 ? buildMetaKeyIndex(existing, eqMetaKeys) : null;

  return candidates.map((txn): DedupResult => {
    if (fpIndex.has(txnFingerprint(txn))) {
      return { isDuplicate: true, matchKind: "fingerprint" };
    }
    if (metaIndex) {
      for (const key of eqMetaKeys) {
        const val = getMetadataValue(txn, key);
        if (val && metaIndex.has(`${key}=${val}`)) {
          return { isDuplicate: true, matchKind: "meta-key" };
        }
      }
    }
    return { isDuplicate: false, matchKind: null };
  });
}

/**
 * Filter out duplicate transactions from candidates.
 * Returns only non-duplicate transactions.
 */
export function filterDuplicates(
  existing: Transaction[],
  candidates: Transaction[],
  eqMetaKeys: string[] = []
): Transaction[] {
  const results = checkDuplicates(existing, candidates, eqMetaKeys);
  return candidates.filter((_, i) => !results[i].isDuplicate);
}

/**
 * Check duplicates within a set of candidates themselves (self-dedup).
 * Useful for detecting duplicates within a single CSV import batch.
 */
export function deduplicateBatch(
  candidates: Transaction[],
  eqMetaKeys: string[] = []
): { unique: Transaction[]; duplicateIndices: number[] } {
  const seen = new Set<string>();
  const metaSeen = eqMetaKeys.length > 0 ? new Set<string>() : null;
  const unique: Transaction[] = [];
  const duplicateIndices: number[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const txn = candidates[i];
    const fp = txnFingerprint(txn);

    if (seen.has(fp)) {
      duplicateIndices.push(i);
      continue;
    }

    if (metaSeen) {
      let metaMatch = false;
      for (const key of eqMetaKeys) {
        const val = getMetadataValue(txn, key);
        if (val && metaSeen.has(`${key}=${val}`)) {
          metaMatch = true;
          break;
        }
      }
      if (metaMatch) {
        duplicateIndices.push(i);
        continue;
      }
      for (const key of eqMetaKeys) {
        const val = getMetadataValue(txn, key);
        if (val) metaSeen.add(`${key}=${val}`);
      }
    }

    seen.add(fp);
    unique.push(txn);
  }

  return { unique, duplicateIndices };
}
