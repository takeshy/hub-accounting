import { describe, it, expect } from "vitest";
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
} from "./reports";
import { addTransaction, createEmptyLedger } from "./ledger";
import { LedgerData } from "../types";

function buildLedger(): LedgerData {
  let l = createEmptyLedger("JPY");
  // Salary: Income → Assets
  l = addTransaction(l, {
    date: "2024-01-25",
    flag: "*",
    narration: "Salary",
    postings: [
      { account: "Assets:Bank", amount: 300000, currency: "JPY" },
      { account: "Income:Salary", amount: -300000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  // Groceries: Assets → Expenses
  l = addTransaction(l, {
    date: "2024-01-26",
    flag: "*",
    narration: "Groceries",
    postings: [
      { account: "Expenses:Food", amount: 5000, currency: "JPY" },
      { account: "Assets:Bank", amount: -5000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  // Feb salary
  l = addTransaction(l, {
    date: "2024-02-25",
    flag: "*",
    narration: "Salary Feb",
    postings: [
      { account: "Assets:Bank", amount: 300000, currency: "JPY" },
      { account: "Income:Salary", amount: -300000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  return l;
}

describe("generateBalanceSheet", () => {
  it("balances to zero (Assets = Liabilities + Equity + NetIncome)", () => {
    const l = buildLedger();
    const bs = generateBalanceSheet(l, "2024-12-31", "JPY");
    expect(bs.difference).toBe(0);
  });

  it("calculates correct asset total", () => {
    const l = buildLedger();
    const bs = generateBalanceSheet(l, "2024-12-31", "JPY");
    // 300000 - 5000 + 300000 = 595000
    expect(bs.totalAssets).toBe(595000);
  });

  it("respects date filter", () => {
    const l = buildLedger();
    const bs = generateBalanceSheet(l, "2024-01-31", "JPY");
    // Only Jan: 300000 - 5000 = 295000
    expect(bs.totalAssets).toBe(295000);
  });

  it("reports zero for empty ledger", () => {
    const l = createEmptyLedger("JPY");
    const bs = generateBalanceSheet(l, "2024-12-31", "JPY");
    expect(bs.totalAssets).toEqual(0);
    expect(bs.totalLiabilities).toEqual(0);
    expect(bs.totalEquity).toEqual(0);
    expect(bs.difference).toEqual(0);
  });
});

describe("generateIncomeStatement", () => {
  it("calculates net income correctly", () => {
    const l = buildLedger();
    const is = generateIncomeStatement(l, "2024-01-01", "2024-01-31", "JPY");
    // Income: 300000, Expenses: 5000, Net: 295000
    expect(is.totalIncome).toBe(300000);
    expect(is.totalExpenses).toBe(5000);
    expect(is.netIncome).toBe(295000);
  });

  it("filters by date range", () => {
    const l = buildLedger();
    const is = generateIncomeStatement(l, "2024-02-01", "2024-02-28", "JPY");
    // Only Feb salary
    expect(is.totalIncome).toBe(300000);
    expect(is.totalExpenses).toBe(0);
    expect(is.netIncome).toBe(300000);
  });

  it("returns zero for empty range", () => {
    const l = buildLedger();
    const is = generateIncomeStatement(l, "2023-01-01", "2023-12-31", "JPY");
    expect(is.totalIncome).toEqual(0);
    expect(is.totalExpenses).toEqual(0);
    expect(is.netIncome).toEqual(0);
  });
});

describe("generateTrialBalance", () => {
  it("debits equal credits", () => {
    const l = buildLedger();
    const tb = generateTrialBalance(l, "2024-12-31", "JPY");
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it("includes all accounts with non-zero balances", () => {
    const l = buildLedger();
    const tb = generateTrialBalance(l, "2024-12-31", "JPY");
    const accounts = tb.entries.map((e) => e.account);
    expect(accounts).toContain("Assets:Bank");
    expect(accounts).toContain("Income:Salary");
    expect(accounts).toContain("Expenses:Food");
  });

  it("skips accounts with invalid type prefix", () => {
    const l = buildLedger();
    const tb = generateTrialBalance(l, "2024-12-31", "JPY");
    for (const entry of tb.entries) {
      expect(["Assets", "Liabilities", "Income", "Expenses", "Equity"]).toContain(entry.type);
    }
  });
});
