/**
 * Beancount format parser.
 * Parses plain-text beancount files into structured directives.
 */

import {
  Directive,
  Transaction,
  Posting,
  TxnFlag,
  LedgerData,
  Account,
  LedgerError,
  MetadataEntry,
  TransactionMetadataEntry,
  ACCOUNT_TYPES,
  AccountType,
  TaxCategory,
  TAX_CATEGORIES,
} from "../types";
import { uid } from "../format";

/** Extract account type from full account name */
function accountType(name: string): AccountType | null {
  const prefix = name.split(":")[0];
  return ACCOUNT_TYPES.includes(prefix as AccountType) ? (prefix as AccountType) : null;
}

/** Parse a beancount-format string into LedgerData */
export function parse(text: string): LedgerData {
  const lines = text.split("\n");
  const directives: Directive[] = [];
  const errors: LedgerError[] = [];
  const options: Record<string, string> = {};
  const accountsMap = new Map<string, Account>();
  const transactions: Transaction[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // Comment lines
    if (trimmed.startsWith(";") || trimmed.startsWith("*")) {
      directives.push({ type: "comment", text: trimmed });
      i++;
      continue;
    }

    // Option directive
    const optionMatch = trimmed.match(/^option\s+"([^"]+)"\s+"([^"]+)"/);
    if (optionMatch) {
      options[optionMatch[1]] = optionMatch[2];
      directives.push({ type: "option", key: optionMatch[1], value: optionMatch[2] });
      i++;
      continue;
    }

    // Date-prefixed directives
    const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(.*)$/);
    if (dateMatch) {
      const date = dateMatch[1];
      const rest = dateMatch[2];

      // Open directive
      const openMatch = rest.match(/^open\s+([\w:-]+)(?:\s+(.+))?$/);
      if (openMatch) {
        const accName = openMatch[1];
        const currencies = openMatch[2] ? openMatch[2].split(/[,\s]+/).filter(Boolean) : [];
        const type = accountType(accName);
        if (type) {
          const account: Account = { name: accName, type, openDate: date, currencies };
          accountsMap.set(accName, account);
          directives.push({ type: "open", date, account: accName, currencies });
        } else {
          errors.push({ line: i + 1, message: `Invalid account type: ${accName}`, severity: "error" });
        }
        i++;
        continue;
      }

      // Close directive
      const closeMatch = rest.match(/^close\s+([\w:-]+)$/);
      if (closeMatch) {
        const accName = closeMatch[1];
        const existing = accountsMap.get(accName);
        if (existing) {
          existing.closeDate = date;
        }
        directives.push({ type: "close", date, account: accName });
        i++;
        continue;
      }

      // Balance directive
      const balanceMatch = rest.match(/^balance\s+([\w:-]+)\s+([-\d.,]+)\s+(\w+)$/);
      if (balanceMatch) {
        directives.push({
          type: "balance",
          date,
          account: balanceMatch[1],
          amount: parseAmount(balanceMatch[2]),
          currency: balanceMatch[3],
        });
        i++;
        continue;
      }

      // Pad directive
      const padMatch = rest.match(/^pad\s+([\w:-]+)\s+([\w:-]+)$/);
      if (padMatch) {
        directives.push({
          type: "pad",
          date,
          account: padMatch[1],
          padAccount: padMatch[2],
        });
        i++;
        continue;
      }

      // Commodity directive
      const commodityMatch = rest.match(/^commodity\s+(\w+)$/);
      if (commodityMatch) {
        directives.push({ type: "commodity", date, currency: commodityMatch[1] });
        i++;
        continue;
      }

      // Transaction directive
      const txnMatch = rest.match(/^([*!]|txn)\s*(.*)/);
      if (txnMatch) {
        const flag: TxnFlag = txnMatch[1] === "!" ? "!" : "*";
        const metaPart = txnMatch[2].trim();

        // Parse payee and narration
        let payee: string | undefined;
        let narration = "";
        const twoStringMatch = metaPart.match(/^"([^"]*)"\s+"([^"]*)"(.*)$/);
        const oneStringMatch = metaPart.match(/^"([^"]*)"(.*)$/);

        if (twoStringMatch) {
          payee = twoStringMatch[1];
          narration = twoStringMatch[2];
          // Parse tags and links from remainder
        } else if (oneStringMatch) {
          narration = oneStringMatch[1];
        } else {
          narration = metaPart;
        }

        // Extract tags and links from remainder after quoted strings only
        const tags: string[] = [];
        const links: string[] = [];
        let remainder = metaPart;
        if (twoStringMatch) {
          remainder = twoStringMatch[3];
        } else if (oneStringMatch) {
          remainder = oneStringMatch[2];
        }
        const tagMatches = remainder.matchAll(/#([\w-]+)/g);
        for (const m of tagMatches) tags.push(m[1]);
        const linkMatches = remainder.matchAll(/\^([\w-]+)/g);
        for (const m of linkMatches) links.push(m[1]);

        // Parse postings and metadata (indented lines following the transaction header)
        // Metadata before any posting is transaction-level; after a posting it belongs to that posting.
        const postings: Posting[] = [];
        const txnMeta: TransactionMetadataEntry[] = [];
        i++;
        while (i < lines.length) {
          const postingLine = lines[i];
          // Posting lines must be indented
          if (!postingLine.match(/^\s+\S/)) break;
          const pt = postingLine.trim();
          const indent = postingLine.match(/^\s*/)?.[0].length || 0;
          // Capture metadata lines (key: value)
          const metaMatch = pt.match(/^([\w-]+):\s+(.*)$/);
          if (metaMatch) {
            const entry: MetadataEntry = [metaMatch[1], metaMatch[2]];
            if (indent >= 4 && postings.length > 0) {
              // Deeper indentation belongs to the most recent posting.
              const last = postings[postings.length - 1];
              if (!last.metadata) last.metadata = [];
              last.metadata.push(entry);
            } else {
              // Two-space indentation is transaction-level metadata regardless of position.
              txnMeta.push({ entry, postingIndex: postings.length });
            }
            i++;
            continue;
          }
          // Skip comment lines within transaction
          if (pt.startsWith(";")) {
            i++;
            continue;
          }

          const postingMatch = pt.match(/^([\w:-]+)(?:\s+([-\d.,]+)\s+(\w+))?$/);
          if (postingMatch) {
            postings.push({
              account: postingMatch[1],
              amount: postingMatch[2] !== undefined ? parseAmount(postingMatch[2]) : null,
              currency: postingMatch[3] || "",
            });
          } else {
            errors.push({ line: i + 1, message: `Invalid posting: ${pt}`, severity: "error" });
          }
          i++;
        }

        // Extract tax-category metadata into typed field
        for (const p of postings) {
          if (p.metadata) {
            const taxIdx = p.metadata.findIndex(([k]) => k === "tax-category");
            if (taxIdx !== -1) {
              const value = p.metadata[taxIdx][1];
              if (TAX_CATEGORIES.includes(value as TaxCategory)) {
                p.taxCategory = value as TaxCategory;
              }
              p.metadata.splice(taxIdx, 1);
              if (p.metadata.length === 0) p.metadata = undefined;
            }
          }
        }

        const txn: Transaction = {
          id: uid(),
          date,
          flag,
          payee,
          narration,
          postings,
          tags,
          links,
          ...(txnMeta.length > 0 ? { metadata: txnMeta } : {}),
        };
        transactions.push(txn);
        directives.push({ type: "transaction", data: txn });
        continue;
      }

      // Unknown date-prefixed directive
      errors.push({ line: i + 1, message: `Unknown directive: ${trimmed}`, severity: "warning" });
      i++;
      continue;
    }

    // Unknown line
    if (trimmed.length > 0 && !trimmed.startsWith(";")) {
      errors.push({ line: i + 1, message: `Unrecognized line: ${trimmed}`, severity: "warning" });
    }
    i++;
  }

  return {
    directives,
    options,
    accounts: Array.from(accountsMap.values()),
    transactions,
    errors,
  };
}

/** Parse a number string, handling comma-separated formats */
function parseAmount(s: string): number {
  // Remove commas used as thousand separators
  const cleaned = s.replace(/,/g, "");
  return Number(cleaned) || 0;
}
