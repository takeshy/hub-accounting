/**
 * freee journal import CSV export.
 * Generates CSV compatible with freee's 仕訳帳インポート format.
 */

import { LedgerData, TaxCategory, Posting } from "../types";
import { autoBalance, getAccountType } from "./ledger";

/** Map TaxCategory + account type to freee tax category name */
function freeeTaxLabel(category: TaxCategory | undefined, accountType: string | null): string {
  if (!category) return "対象外";
  switch (category) {
    case "taxable_10":
      return accountType === "Income" ? "課税売上10%" : "課対仕入10%";
    case "taxable_8":
      return accountType === "Income" ? "課税売上8%(軽)" : "課対仕入8%(軽)";
    case "exempt":
      return accountType === "Income" ? "非課売上" : "非課仕入";
    case "non_taxable":
      return "対象外";
    case "tax_free":
      return "不課税";
    default:
      return "対象外";
  }
}

/** Translate account name to Japanese display name using i18n function */
function translateAccount(accountName: string, i18nFn: (key: string) => string): string {
  const translated = i18nFn(`account.${accountName}`);
  // If no translation found, i18n returns the key itself
  if (translated === `account.${accountName}`) {
    // Fall back to last component of account name
    const parts = accountName.split(":");
    return parts[parts.length - 1];
  }
  return translated;
}

/** Split account name into main account and sub-account */
function splitAccount(accountName: string, i18nFn: (key: string) => string): [string, string] {
  const parts = accountName.split(":");
  if (parts.length <= 2) {
    return [translateAccount(accountName, i18nFn), ""];
  }
  // Main account = Type:First, sub = rest
  const mainName = `${parts[0]}:${parts[1]}`;
  const subName = parts.slice(2).join(":");
  return [translateAccount(mainName, i18nFn), subName];
}

/** Escape a CSV field */
function csvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export ledger transactions as freee journal import CSV.
 *
 * Format: 取引日,借方勘定科目,借方補助科目,借方税区分,借方金額,貸方勘定科目,貸方補助科目,貸方税区分,貸方金額,摘要
 */
export function exportFreeeCSV(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string,
  i18nFn: (key: string) => string
): string {
  const header = "取引日,借方勘定科目,借方補助科目,借方税区分,借方金額,貸方勘定科目,貸方補助科目,貸方税区分,貸方金額,摘要";
  const rows: string[] = [header];

  const txns = ledger.transactions.filter(
    (t) => t.date >= dateFrom && t.date <= dateTo
  );

  for (const txn of txns) {
    const balanced = autoBalance(txn);
    const postings = balanced.postings.filter(
      (p) => p.amount !== null && p.currency === currency
    );

    // Split into debit (amount > 0) and credit (amount < 0) postings
    const debits: Posting[] = [];
    const credits: Posting[] = [];
    for (const p of postings) {
      if (p.amount! > 0) debits.push(p);
      else if (p.amount! < 0) credits.push(p);
    }

    // Build narration string
    const narration = txn.payee
      ? `${txn.payee} ${txn.narration}`
      : txn.narration;

    // Pair debits and credits into rows
    const maxLen = Math.max(debits.length, credits.length);
    for (let i = 0; i < maxLen; i++) {
      const d = debits[i];
      const c = credits[i];

      const dAccType = d ? getAccountType(d.account) : null;
      const cAccType = c ? getAccountType(c.account) : null;
      const [dMain, dSub] = d ? splitAccount(d.account, i18nFn) : ["", ""];
      const [cMain, cSub] = c ? splitAccount(c.account, i18nFn) : ["", ""];
      const dTax = d ? freeeTaxLabel(d.taxCategory, dAccType) : "";
      const cTax = c ? freeeTaxLabel(c.taxCategory, cAccType) : "";
      const dAmt = d ? Math.abs(d.amount!) : 0;
      const cAmt = c ? Math.abs(c.amount!) : 0;

      const row = [
        txn.date,
        csvField(dMain),
        csvField(dSub),
        dTax,
        dAmt ? String(dAmt) : "",
        csvField(cMain),
        csvField(cSub),
        cTax,
        cAmt ? String(cAmt) : "",
        csvField(i === 0 ? narration : ""),
      ].join(",");

      rows.push(row);
    }
  }

  return rows.join("\n") + "\n";
}
