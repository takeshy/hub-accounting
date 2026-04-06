/**
 * Japanese consumption tax (消費税) calculation and report generation.
 */

import { TaxCategory, LedgerData } from "../types";
import { getAccountType, autoBalance } from "./ledger";

/** Tax rate fractions to avoid floating-point errors */
const TAX_FRACTIONS: Record<string, [number, number]> = {
  taxable_10: [10, 110],
  taxable_8: [8, 108],
};

/**
 * Extract tax amount from a tax-included amount.
 * Uses integer-friendly fraction: floor(|amount| * numerator / denominator)
 */
export function extractTax(amount: number, category: TaxCategory): number {
  const frac = TAX_FRACTIONS[category];
  if (!frac) return 0;
  const sign = amount < 0 ? -1 : 1;
  return Math.floor(Math.abs(amount) * frac[0] / frac[1]) * sign;
}

/** Summary for one tax rate category */
export interface TaxCategorySummary {
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
}

function emptySummary(): TaxCategorySummary {
  return { totalAmount: 0, taxAmount: 0, netAmount: 0 };
}

/** Consumption tax report data */
export interface ConsumptionTaxReport {
  dateFrom: string;
  dateTo: string;
  currency: string;
  sales: {
    taxable10: TaxCategorySummary;
    taxable8: TaxCategorySummary;
    exempt: TaxCategorySummary;
    totalTax: number;
  };
  purchases: {
    taxable10: TaxCategorySummary;
    taxable8: TaxCategorySummary;
    exempt: TaxCategorySummary;
    totalTax: number;
  };
  netTaxPayable: number;
}

/** Generate a consumption tax report for a date range. */
export function generateConsumptionTaxReport(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string
): ConsumptionTaxReport {
  const txns = ledger.transactions.filter(
    (t) => t.date >= dateFrom && t.date <= dateTo
  );

  const salesByCategory = new Map<TaxCategory, number>();
  const purchasesByCategory = new Map<TaxCategory, number>();

  for (const txn of txns) {
    const balanced = autoBalance(txn);
    for (const p of balanced.postings) {
      if (p.amount === null || p.currency !== currency || !p.taxCategory) continue;
      const accType = getAccountType(p.account);

      if (accType === "Income") {
        // Income postings are negative in beancount; negate for positive sales
        salesByCategory.set(
          p.taxCategory,
          (salesByCategory.get(p.taxCategory) || 0) + (-p.amount)
        );
      } else if (accType === "Expenses") {
        purchasesByCategory.set(
          p.taxCategory,
          (purchasesByCategory.get(p.taxCategory) || 0) + p.amount
        );
      }
    }
  }

  function buildSummary(total: number, category: TaxCategory): TaxCategorySummary {
    const tax = extractTax(total, category);
    return { totalAmount: total, taxAmount: tax, netAmount: total - tax };
  }

  const sales = {
    taxable10: buildSummary(salesByCategory.get("taxable_10") || 0, "taxable_10"),
    taxable8: buildSummary(salesByCategory.get("taxable_8") || 0, "taxable_8"),
    exempt: buildSummary(salesByCategory.get("exempt") || 0, "exempt"),
    totalTax: 0,
  };
  sales.totalTax = sales.taxable10.taxAmount + sales.taxable8.taxAmount;

  const purchases = {
    taxable10: buildSummary(purchasesByCategory.get("taxable_10") || 0, "taxable_10"),
    taxable8: buildSummary(purchasesByCategory.get("taxable_8") || 0, "taxable_8"),
    exempt: buildSummary(purchasesByCategory.get("exempt") || 0, "exempt"),
    totalTax: 0,
  };
  purchases.totalTax = purchases.taxable10.taxAmount + purchases.taxable8.taxAmount;

  return {
    dateFrom,
    dateTo,
    currency,
    sales,
    purchases,
    netTaxPayable: sales.totalTax - purchases.totalTax,
  };
}
