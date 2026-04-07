import { describe, it, expect } from "vitest";
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
  generateGeneralLedger,
  generateSubsidiaryLedger,
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

function buildLedgerWithPayees(): LedgerData {
  let l = createEmptyLedger("JPY");
  l = addTransaction(l, {
    date: "2024-01-10",
    flag: "*",
    payee: "ClientA",
    narration: "Invoice 001",
    postings: [
      { account: "Assets:AccountsReceivable", amount: 100000, currency: "JPY" },
      { account: "Income:Sales", amount: -100000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  l = addTransaction(l, {
    date: "2024-01-20",
    flag: "*",
    payee: "ClientA",
    narration: "Payment received",
    postings: [
      { account: "Assets:Bank", amount: 100000, currency: "JPY" },
      { account: "Assets:AccountsReceivable", amount: -100000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  l = addTransaction(l, {
    date: "2024-02-05",
    flag: "*",
    payee: "SupplierX",
    narration: "Office supplies",
    postings: [
      { account: "Expenses:Supplies", amount: 5000, currency: "JPY" },
      { account: "Assets:Cash", amount: -5000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  l = addTransaction(l, {
    date: "2024-02-15",
    flag: "*",
    payee: "ClientA",
    narration: "Invoice 002",
    postings: [
      { account: "Assets:AccountsReceivable", amount: 200000, currency: "JPY" },
      { account: "Income:Sales", amount: -200000, currency: "JPY" },
    ],
    tags: [],
    links: [],
  });
  return l;
}

describe("generateGeneralLedger", () => {
  it("shows all entries for a given account with running balance", () => {
    const l = buildLedgerWithPayees();
    const gl = generateGeneralLedger(l, "Assets:AccountsReceivable", "2024-01-01", "2024-12-31", "JPY");
    expect(gl.entries).toHaveLength(3);
    // Entry 1: +100000
    expect(gl.entries[0].debit).toBe(100000);
    expect(gl.entries[0].credit).toBe(0);
    expect(gl.entries[0].balance).toBe(100000);
    // Entry 2: -100000
    expect(gl.entries[1].debit).toBe(0);
    expect(gl.entries[1].credit).toBe(100000);
    expect(gl.entries[1].balance).toBe(0);
    // Entry 3: +200000
    expect(gl.entries[2].debit).toBe(200000);
    expect(gl.entries[2].credit).toBe(0);
    expect(gl.entries[2].balance).toBe(200000);
  });

  it("calculates opening balance from transactions before dateFrom", () => {
    const l = buildLedgerWithPayees();
    const gl = generateGeneralLedger(l, "Assets:AccountsReceivable", "2024-02-01", "2024-12-31", "JPY");
    // Before Feb: +100000 - 100000 = 0
    expect(gl.openingBalance).toBe(0);
    expect(gl.entries).toHaveLength(1);
    expect(gl.entries[0].balance).toBe(200000);
    expect(gl.closingBalance).toBe(200000);
  });

  it("shows counterpart accounts", () => {
    const l = buildLedgerWithPayees();
    const gl = generateGeneralLedger(l, "Assets:AccountsReceivable", "2024-01-01", "2024-12-31", "JPY");
    expect(gl.entries[0].counterpart).toBe("Income:Sales");
    expect(gl.entries[1].counterpart).toBe("Assets:Bank");
  });

  it("totals debit and credit correctly", () => {
    const l = buildLedgerWithPayees();
    const gl = generateGeneralLedger(l, "Assets:AccountsReceivable", "2024-01-01", "2024-12-31", "JPY");
    expect(gl.totalDebit).toBe(300000);
    expect(gl.totalCredit).toBe(100000);
  });

  it("returns empty entries for account with no transactions", () => {
    const l = buildLedgerWithPayees();
    const gl = generateGeneralLedger(l, "Liabilities:Borrowings", "2024-01-01", "2024-12-31", "JPY");
    expect(gl.entries).toHaveLength(0);
    expect(gl.openingBalance).toBe(0);
    expect(gl.closingBalance).toBe(0);
  });
});

describe("generateSubsidiaryLedger", () => {
  it("shows all postings for a given payee", () => {
    const l = buildLedgerWithPayees();
    const sl = generateSubsidiaryLedger(l, "ClientA", "2024-01-01", "2024-12-31", "JPY");
    // 3 transactions × 2 postings each = 6
    expect(sl.entries).toHaveLength(6);
    expect(sl.payee).toBe("ClientA");
  });

  it("filters by date range", () => {
    const l = buildLedgerWithPayees();
    const sl = generateSubsidiaryLedger(l, "ClientA", "2024-01-01", "2024-01-31", "JPY");
    // 2 transactions in Jan × 2 postings = 4
    expect(sl.entries).toHaveLength(4);
  });

  it("totals debit and credit correctly", () => {
    const l = buildLedgerWithPayees();
    const sl = generateSubsidiaryLedger(l, "SupplierX", "2024-01-01", "2024-12-31", "JPY");
    // 1 transaction: Expenses:Supplies 5000 (debit), Assets:Cash -5000 (credit)
    expect(sl.totalDebit).toBe(5000);
    expect(sl.totalCredit).toBe(5000);
  });

  it("returns empty for non-existent payee", () => {
    const l = buildLedgerWithPayees();
    const sl = generateSubsidiaryLedger(l, "Unknown", "2024-01-01", "2024-12-31", "JPY");
    expect(sl.entries).toHaveLength(0);
    expect(sl.totalDebit).toBe(0);
    expect(sl.totalCredit).toBe(0);
  });
});
