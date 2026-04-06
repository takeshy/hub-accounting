import { describe, it, expect } from "vitest";
import {
  isBalanced,
  autoBalance,
  calculateBalances,
  addTransaction,
  removeTransaction,
  createEmptyLedger,
  validate,
  refreshErrors,
} from "./ledger";
import { Transaction, LedgerData } from "../types";

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "test-1",
    date: "2024-01-15",
    flag: "*",
    narration: "Test",
    postings: [
      { account: "Expenses:Food", amount: 1000, currency: "JPY" },
      { account: "Assets:Cash", amount: -1000, currency: "JPY" },
    ],
    tags: [],
    links: [],
    ...overrides,
  };
}

describe("isBalanced", () => {
  it("returns true for balanced transaction", () => {
    const txn = makeTxn();
    expect(isBalanced(txn)).toBe(true);
  });

  it("returns false for unbalanced transaction", () => {
    const txn = makeTxn({
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -500, currency: "JPY" },
      ],
    });
    expect(isBalanced(txn)).toBe(false);
  });

  it("returns true when one posting has null amount (auto-balance)", () => {
    const txn = makeTxn({
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: null, currency: "JPY" },
      ],
    });
    expect(isBalanced(txn)).toBe(true);
  });

  it("returns false when multiple postings have null amount", () => {
    const txn = makeTxn({
      postings: [
        { account: "Expenses:Food", amount: null, currency: "JPY" },
        { account: "Assets:Cash", amount: null, currency: "JPY" },
      ],
    });
    expect(isBalanced(txn)).toBe(false);
  });

  it("returns false when auto-balance would require multiple currencies", () => {
    const txn = makeTxn({
      postings: [
        { account: "Assets:Cash", amount: 100, currency: "USD" },
        { account: "Expenses:Food", amount: -10000, currency: "JPY" },
        { account: "Equity:Opening-Balances", amount: null, currency: "" },
      ],
    });
    expect(isBalanced(txn)).toBe(false);
  });
});

describe("autoBalance", () => {
  it("fills in null posting amount", () => {
    const txn = makeTxn({
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: null, currency: "" },
      ],
    });
    const balanced = autoBalance(txn);
    expect(balanced.postings[1].amount).toBe(-1000);
    expect(balanced.postings[1].currency).toBe("JPY");
  });

  it("does nothing if no null postings", () => {
    const txn = makeTxn();
    const result = autoBalance(txn);
    expect(result).toEqual(txn);
  });
});

describe("calculateBalances", () => {
  it("calculates correct balances", () => {
    const ledger = createEmptyLedger("JPY");
    const ledger2 = addTransaction(ledger, {
      date: "2024-01-15",
      flag: "*",
      narration: "Groceries",
      postings: [
        { account: "Expenses:Food", amount: 5000, currency: "JPY" },
        { account: "Assets:Cash", amount: -5000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    const balances = calculateBalances(ledger2);
    const foodBal = balances.find((b) => b.account === "Expenses:Food");
    const cashBal = balances.find((b) => b.account === "Assets:Cash");

    expect(foodBal?.balances["JPY"]).toBe(5000);
    expect(cashBal?.balances["JPY"]).toBe(-5000);
  });

  it("respects date filter", () => {
    const ledger = createEmptyLedger("JPY");
    let l = addTransaction(ledger, {
      date: "2024-01-15",
      flag: "*",
      narration: "Jan",
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    l = addTransaction(l, {
      date: "2024-02-15",
      flag: "*",
      narration: "Feb",
      postings: [
        { account: "Expenses:Food", amount: 2000, currency: "JPY" },
        { account: "Assets:Cash", amount: -2000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    const janBalances = calculateBalances(l, "2024-01-31");
    const foodBal = janBalances.find((b) => b.account === "Expenses:Food");
    expect(foodBal?.balances["JPY"]).toBe(1000);

    const allBalances = calculateBalances(l);
    const foodBalAll = allBalances.find((b) => b.account === "Expenses:Food");
    expect(foodBalAll?.balances["JPY"]).toBe(3000);
  });
});

describe("addTransaction / removeTransaction", () => {
  it("adds and removes transactions", () => {
    const ledger = createEmptyLedger("JPY");
    const l = addTransaction(ledger, {
      date: "2024-01-15",
      flag: "*",
      narration: "Test",
      postings: [
        { account: "Expenses:Food", amount: 100, currency: "JPY" },
        { account: "Assets:Cash", amount: -100, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    expect(l.transactions).toHaveLength(1);
    const txnId = l.transactions[0].id;

    const l2 = removeTransaction(l, txnId);
    expect(l2.transactions).toHaveLength(0);
  });
});

describe("validate", () => {
  it("detects unbalanced transactions", () => {
    const ledger = createEmptyLedger("JPY");
    // Manually add an unbalanced transaction
    const unbalanced: LedgerData = {
      ...ledger,
      transactions: [
        makeTxn({
          postings: [
            { account: "Expenses:Food", amount: 1000, currency: "JPY" },
            { account: "Assets:Cash", amount: -500, currency: "JPY" },
          ],
        }),
      ],
    };

    const errors = validate(unbalanced);
    expect(errors.some((e) => e.message.includes("Unbalanced"))).toBe(true);
  });

  it("warns about unopened accounts", () => {
    const ledger = createEmptyLedger("JPY");
    const l: LedgerData = {
      ...ledger,
      transactions: [
        makeTxn({
          postings: [
            { account: "Expenses:Unknown", amount: 1000, currency: "JPY" },
            { account: "Assets:Cash", amount: -1000, currency: "JPY" },
          ],
        }),
      ],
    };

    const errors = validate(l);
    expect(errors.some((e) => e.message.includes("not opened"))).toBe(true);
  });
});

describe("createEmptyLedger", () => {
  it("creates a ledger with default accounts", () => {
    const ledger = createEmptyLedger("JPY");
    expect(ledger.accounts.length).toBeGreaterThan(0);
    expect(ledger.options["operating_currency"]).toBe("JPY");
    expect(ledger.transactions).toHaveLength(0);
    expect(ledger.errors).toHaveLength(0);
  });

  it("creates default template accounts with no second arg", () => {
    const ledger = createEmptyLedger("JPY");
    const names = ledger.accounts.map((a) => a.name);
    expect(names).toContain("Assets:Bank");
    expect(names).toContain("Expenses:Food");
  });

  it("creates japan_sole_proprietor template with Japanese standard accounts", () => {
    const ledger = createEmptyLedger("JPY", "japan_sole_proprietor");
    const names = ledger.accounts.map((a) => a.name);
    // Should have Japanese business accounts
    expect(names).toContain("Income:Sales");
    expect(names).toContain("Expenses:Purchases");
    expect(names).toContain("Expenses:TaxesDues");
    expect(names).toContain("Expenses:Entertainment");
    expect(names).toContain("Equity:OwnerDraw");
    expect(names).toContain("Equity:OwnerContribution");
    // Should NOT have default template accounts
    expect(names).not.toContain("Assets:Bank");
    expect(names).not.toContain("Expenses:Food");
  });

  it("japan_sole_proprietor has all 青色申告 expense categories", () => {
    const ledger = createEmptyLedger("JPY", "japan_sole_proprietor");
    const expenses = ledger.accounts.filter((a) => a.type === "Expenses");
    // 19 expense categories from 青色申告決算書
    expect(expenses.length).toBe(19);
  });
});

describe("refreshErrors", () => {
  it("keeps parse errors and adds validation errors", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      errors: [{ line: 3, message: "Parse error", severity: "warning" }],
      transactions: [
        makeTxn({
          postings: [
            { account: "Expenses:Food", amount: 1000, currency: "JPY" },
            { account: "Assets:Cash", amount: -500, currency: "JPY" },
          ],
        }),
      ],
    };

    const refreshed = refreshErrors(ledger);
    expect(refreshed.errors.some((e) => e.line === 3 && e.message === "Parse error")).toBe(true);
    expect(refreshed.errors.some((e) => e.message.includes("Unbalanced transaction"))).toBe(true);
  });
});
