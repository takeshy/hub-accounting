import { describe, it, expect } from "vitest";
import { extractTax, generateConsumptionTaxReport } from "./tax";
import { addTransaction, createEmptyLedger } from "./ledger";
import { LedgerData } from "../types";

describe("extractTax", () => {
  it("extracts 10% tax from tax-included amount", () => {
    // 1100 * 10/110 = 100
    expect(extractTax(1100, "taxable_10")).toBe(100);
  });

  it("extracts 8% tax from tax-included amount", () => {
    // 1080 * 8/108 = 80
    expect(extractTax(1080, "taxable_8")).toBe(80);
  });

  it("truncates (floors) fractional tax", () => {
    // 999 * 10/110 = 90.818... → 90
    expect(extractTax(999, "taxable_10")).toBe(90);
  });

  it("handles negative amounts", () => {
    expect(extractTax(-1100, "taxable_10")).toBe(-100);
  });

  it("returns 0 for exempt", () => {
    expect(extractTax(1000, "exempt")).toBe(0);
  });

  it("returns 0 for non_taxable", () => {
    expect(extractTax(1000, "non_taxable")).toBe(0);
  });

  it("returns 0 for tax_free", () => {
    expect(extractTax(1000, "tax_free")).toBe(0);
  });

  it("returns 0 for zero amount", () => {
    expect(extractTax(0, "taxable_10")).toBe(0);
  });
});

describe("generateConsumptionTaxReport", () => {
  function buildTaxLedger(): LedgerData {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    // Sale at 10%: Income:Sales -11000, Assets:Cash 11000
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      narration: "Sale 10%",
      postings: [
        { account: "Assets:Cash", amount: 11000, currency: "JPY" },
        { account: "Income:Sales", amount: -11000, currency: "JPY", taxCategory: "taxable_10" },
      ],
      tags: [],
      links: [],
    });
    // Sale at 8%: Income:Sales -1080, Assets:Cash 1080
    l = addTransaction(l, {
      date: "2024-01-16",
      flag: "*",
      narration: "Sale 8%",
      postings: [
        { account: "Assets:Cash", amount: 1080, currency: "JPY" },
        { account: "Income:Sales", amount: -1080, currency: "JPY", taxCategory: "taxable_8" },
      ],
      tags: [],
      links: [],
    });
    // Purchase at 10%: Expenses:Supplies 5500, Assets:Cash -5500
    l = addTransaction(l, {
      date: "2024-01-17",
      flag: "*",
      narration: "Purchase 10%",
      postings: [
        { account: "Expenses:Supplies", amount: 5500, currency: "JPY", taxCategory: "taxable_10" },
        { account: "Assets:Cash", amount: -5500, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    return l;
  }

  it("calculates sales tax correctly", () => {
    const l = buildTaxLedger();
    const r = generateConsumptionTaxReport(l, "2024-01-01", "2024-12-31", "JPY");
    // Sales 10%: 11000, tax = 1000
    expect(r.sales.taxable10.totalAmount).toBe(11000);
    expect(r.sales.taxable10.taxAmount).toBe(1000);
    // Sales 8%: 1080, tax = 80
    expect(r.sales.taxable8.totalAmount).toBe(1080);
    expect(r.sales.taxable8.taxAmount).toBe(80);
    expect(r.sales.totalTax).toBe(1080);
  });

  it("calculates purchase tax correctly", () => {
    const l = buildTaxLedger();
    const r = generateConsumptionTaxReport(l, "2024-01-01", "2024-12-31", "JPY");
    // Purchases 10%: 5500, tax = 500
    expect(r.purchases.taxable10.totalAmount).toBe(5500);
    expect(r.purchases.taxable10.taxAmount).toBe(500);
    expect(r.purchases.totalTax).toBe(500);
  });

  it("calculates net tax payable", () => {
    const l = buildTaxLedger();
    const r = generateConsumptionTaxReport(l, "2024-01-01", "2024-12-31", "JPY");
    // 1080 - 500 = 580
    expect(r.netTaxPayable).toBe(580);
  });

  it("filters by date range", () => {
    const l = buildTaxLedger();
    const r = generateConsumptionTaxReport(l, "2024-01-15", "2024-01-15", "JPY");
    expect(r.sales.taxable10.totalAmount).toBe(11000);
    expect(r.sales.taxable8.totalAmount).toBe(0);
    expect(r.purchases.taxable10.totalAmount).toBe(0);
  });

  it("ignores postings without taxCategory", () => {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      narration: "No tax",
      postings: [
        { account: "Expenses:Supplies", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const r = generateConsumptionTaxReport(l, "2024-01-01", "2024-12-31", "JPY");
    expect(r.sales.totalTax).toBe(0);
    expect(r.purchases.totalTax).toBe(0);
    expect(r.netTaxPayable).toBe(0);
  });
});
