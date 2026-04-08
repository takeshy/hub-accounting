/**
 * Shared account/tax utilities used by csv.ts and sheets.ts.
 */

import { TaxCategory } from "../types";

/** Map TaxCategory + account type to Japanese tax label (freee-compatible) */
export function taxLabel(category: TaxCategory | undefined, accountType: string | null): string {
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

/** Translate account name using i18n. Falls back to last component. */
export function translateAccount(accountName: string, i18nFn: (key: string) => string): string {
  const translated = i18nFn(`account.${accountName}`);
  if (translated === `account.${accountName}`) {
    const parts = accountName.split(":");
    return parts[parts.length - 1];
  }
  return translated;
}

/** Split account name into main account and sub-account */
export function splitAccount(accountName: string, i18nFn: (key: string) => string): [string, string] {
  const parts = accountName.split(":");
  if (parts.length <= 2) {
    return [translateAccount(accountName, i18nFn), ""];
  }
  const mainName = `${parts[0]}:${parts[1]}`;
  const subName = parts.slice(2).join(":");
  return [translateAccount(mainName, i18nFn), subName];
}
