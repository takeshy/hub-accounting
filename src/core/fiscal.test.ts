import { describe, it, expect } from "vitest";
import { getFiscalYear, getFiscalYearRange, getFiscalYearFileName, carryForward } from "./fiscal";
import { addTransaction, createEmptyLedger, calculateBalances, getBalancesByType, sumBalances } from "./ledger";
import { generateBalanceSheet } from "./reports";
import { LedgerData } from "../types";

describe("getFiscalYear", () => {
  it("returns year for January start (default)", () => {
    expect(getFiscalYear("2024-06-15", 1)).toBe(2024);
    expect(getFiscalYear("2024-01-01", 1)).toBe(2024);
    expect(getFiscalYear("2024-12-31", 1)).toBe(2024);
  });

  it("returns year for April start (Japanese corporate)", () => {
    expect(getFiscalYear("2024-04-01", 4)).toBe(2024);
    expect(getFiscalYear("2025-03-31", 4)).toBe(2024);
    expect(getFiscalYear("2025-04-01", 4)).toBe(2025);
    expect(getFiscalYear("2024-03-31", 4)).toBe(2023);
  });

  it("returns year for October start", () => {
    expect(getFiscalYear("2024-10-01", 10)).toBe(2024);
    expect(getFiscalYear("2025-09-30", 10)).toBe(2024);
    expect(getFiscalYear("2024-09-30", 10)).toBe(2023);
  });
});

describe("getFiscalYearRange", () => {
  it("returns range for January start", () => {
    const r = getFiscalYearRange(2024, 1);
    expect(r.start).toBe("2024-01-01");
    expect(r.end).toBe("2024-12-31");
  });

  it("returns range for April start", () => {
    const r = getFiscalYearRange(2024, 4);
    expect(r.start).toBe("2024-04-01");
    expect(r.end).toBe("2025-03-31");
  });

  it("returns range for October start", () => {
    const r = getFiscalYearRange(2024, 10);
    expect(r.start).toBe("2024-10-01");
    expect(r.end).toBe("2025-09-30");
  });

  it("handles February end (leap year)", () => {
    const r = getFiscalYearRange(2024, 3);
    expect(r.end).toBe("2025-02-28");
  });
});

describe("getFiscalYearFileName", () => {
  it("returns correct path", () => {
    expect(getFiscalYearFileName(2024, "accounting")).toBe("accounting/2024.beancount");
  });

  it("works with custom directory", () => {
    expect(getFiscalYearFileName(2025, "books")).toBe("books/2025.beancount");
  });
});

describe("carryForward", () => {
  function buildLedger(): LedgerData {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    // Salary: Income → Assets
    l = addTransaction(l, {
      date: "2024-01-25",
      flag: "*",
      narration: "Salary",
      postings: [
        { account: "Assets:OrdinaryDeposit", amount: 300000, currency: "JPY" },
        { account: "Income:Sales", amount: -300000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    // Expense: Assets → Expenses
    l = addTransaction(l, {
      date: "2024-02-10",
      flag: "*",
      narration: "Rent",
      postings: [
        { account: "Expenses:Rent", amount: 80000, currency: "JPY" },
        { account: "Assets:OrdinaryDeposit", amount: -80000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    return l;
  }

  it("creates a new ledger with carry-forward transactions", () => {
    const old = buildLedger();
    const newLedger = carryForward(old, 2025, 1, "JPY");
    expect(newLedger.transactions.length).toBeGreaterThan(0);
    expect(newLedger.accounts.length).toBeGreaterThanOrEqual(old.accounts.length);
  });

  it("carries forward asset balances", () => {
    const old = buildLedger();
    const newLedger = carryForward(old, 2025, 1, "JPY");
    const balances = calculateBalances(newLedger);
    const deposit = balances.find((b) => b.account === "Assets:OrdinaryDeposit");
    // 300000 - 80000 = 220000
    expect(deposit?.balances["JPY"]).toBe(220000);
  });

  it("does not carry forward income/expense balances", () => {
    const old = buildLedger();
    const newLedger = carryForward(old, 2025, 1, "JPY");
    const balances = calculateBalances(newLedger);
    const sales = balances.find((b) => b.account === "Income:Sales");
    const rent = balances.find((b) => b.account === "Expenses:Rent");
    expect(sales).toBeUndefined();
    expect(rent).toBeUndefined();
  });

  it("tags carry-forward transactions", () => {
    const old = buildLedger();
    const newLedger = carryForward(old, 2025, 1, "JPY");
    for (const txn of newLedger.transactions) {
      expect(txn.tags).toContain("carry-forward");
    }
  });

  it("uses fiscal year start date for opening entries", () => {
    const old = buildLedger();
    const newLedger = carryForward(old, 2025, 4, "JPY");
    for (const txn of newLedger.transactions) {
      expect(txn.date).toBe("2025-04-01");
    }
  });

  it("produces a balanced balance sheet after carry-forward", () => {
    const old = buildLedger();
    const newLedger = carryForward(old, 2025, 1, "JPY");
    const bs = generateBalanceSheet(newLedger, "2025-12-31", "JPY");
    expect(bs.difference).toBe(0);
  });

  it("includes net income in equity after carry-forward", () => {
    const old = buildLedger();
    // Net income = 300000 (income) - 80000 (expenses) = 220000
    // Assets = 220000 (OrdinaryDeposit)
    // After carry-forward, equity should balance assets
    const newLedger = carryForward(old, 2025, 1, "JPY");
    const balances = calculateBalances(newLedger);
    const byType = getBalancesByType(balances);
    const totalAssets = sumBalances(byType.Assets, "JPY") || 0;
    const totalEquity = -sumBalances(byType.Equity, "JPY") || 0;
    expect(totalAssets).toBe(totalEquity);
  });

  it("handles empty ledger", () => {
    const empty = createEmptyLedger("JPY", "japan_sole_proprietor");
    const newLedger = carryForward(empty, 2025, 1, "JPY");
    expect(newLedger.transactions).toHaveLength(0);
    expect(newLedger.accounts.length).toBe(empty.accounts.length);
  });
});
