import { describe, it, expect } from "vitest";
import {
  isBalanced,
  autoBalance,
  calculateBalances,
  addTransaction,
  removeTransaction,
  addBalanceDirective,
  createEmptyLedger,
  validate,
  refreshErrors,
  processPadDirectives,
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

describe("addBalanceDirective", () => {
  it("adds a balance directive and refreshes validation errors", () => {
    const ledger = createEmptyLedger("JPY");
    const next = addBalanceDirective(ledger, {
      date: "2024-01-31",
      account: "Assets:Cash",
      amount: 1000,
      currency: "JPY",
    });

    expect(next.directives[next.directives.length - 1]).toEqual({
      type: "balance",
      date: "2024-01-31",
      account: "Assets:Cash",
      amount: 1000,
      currency: "JPY",
    });
    expect(next.errors.some((e) => e.message.includes("Balance assertion failed"))).toBe(true);
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

  it("evaluates balance directives at the beginning of the day", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 1000, currency: "JPY" },
      ],
      transactions: [
        {
          id: "txn-1",
          date: "2024-01-09",
          flag: "*",
          narration: "opening",
          postings: [
            { account: "Assets:Cash", amount: 1000, currency: "JPY" },
            { account: "Equity:Opening-Balances", amount: -1000, currency: "JPY" },
          ],
          tags: [],
          links: [],
        },
        {
          id: "txn-2",
          date: "2024-01-10",
          flag: "*",
          narration: "same day expense",
          postings: [
            { account: "Expenses:Food", amount: 200, currency: "JPY" },
            { account: "Assets:Cash", amount: -200, currency: "JPY" },
          ],
          tags: [],
          links: [],
        },
      ],
    };

    const errors = validate(ledger);
    expect(errors.some((e) => e.message.includes("Balance assertion failed"))).toBe(false);
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

describe("processPadDirectives", () => {
  it("generates a padding transaction to fill balance gap", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      transactions: [],
    };

    const result = processPadDirectives(ledger);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].postings[0].account).toBe("Assets:Cash");
    expect(result.transactions[0].postings[0].amount).toBe(10000);
    expect(result.transactions[0].postings[1].account).toBe("Equity:Opening-Balances");
    expect(result.transactions[0].postings[1].amount).toBe(-10000);
  });

  it("accounts for existing balance before pad date", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-05", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      transactions: [
        {
          id: "existing-1",
          date: "2024-01-03",
          flag: "*",
          narration: "Initial deposit",
          postings: [
            { account: "Assets:Cash", amount: 3000, currency: "JPY" },
            { account: "Equity:Opening-Balances", amount: -3000, currency: "JPY" },
          ],
          tags: [],
          links: [],
        },
      ],
    };

    const result = processPadDirectives(ledger);
    const padTxn = result.transactions.find((t) => t.tags.includes("pad"));
    expect(padTxn).toBeDefined();
    expect(padTxn!.postings[0].amount).toBe(7000);
  });

  it("accounts for transactions between pad date and balance assertion", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Income:Sales", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      transactions: [
        {
          id: "existing-1",
          date: "2024-01-05",
          flag: "*",
          narration: "Sale",
          postings: [
            { account: "Assets:Cash", amount: 3000, currency: "JPY" },
            { account: "Income:Sales", amount: -3000, currency: "JPY" },
          ],
          tags: [],
          links: [],
        },
      ],
    };

    const result = processPadDirectives(ledger);
    const padTxn = result.transactions.find((t) => t.tags.includes("pad"));
    expect(padTxn).toBeDefined();
    expect(padTxn!.postings[0].amount).toBe(7000);
  });

  it("is idempotent when run repeatedly", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      transactions: [],
    };

    const once = processPadDirectives(ledger);
    const twice = processPadDirectives(once);
    expect(twice.transactions.filter((t) => t.tags.includes("pad"))).toHaveLength(1);
    expect(twice.transactions.filter((t) => t.tags.includes("pad"))[0].postings[0].amount).toBe(10000);
  });

  it("uses the nearest following balance assertion by date", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-02-01", account: "Assets:Cash", amount: 20000, currency: "JPY" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      transactions: [],
    };

    const result = processPadDirectives(ledger);
    const padTxn = result.transactions.find((t) => t.tags.includes("pad"));
    expect(padTxn).toBeDefined();
    expect(padTxn!.postings[0].amount).toBe(10000);
  });

  it("does nothing when no pad directives exist", () => {
    const ledger = createEmptyLedger("JPY");
    const result = processPadDirectives(ledger);
    expect(result.transactions).toHaveLength(0);
  });

  it("does nothing when no balance assertion follows pad", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
      ],
      transactions: [],
    };

    const result = processPadDirectives(ledger);
    expect(result.transactions).toHaveLength(0);
  });

  it("does nothing when balance already matches", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 0, currency: "JPY" },
      ],
      transactions: [],
    };

    const result = processPadDirectives(ledger);
    expect(result.transactions).toHaveLength(0);
  });

  it("generates balanced padding transaction", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      directives: [
        { type: "open", date: "2024-01-01", account: "Assets:Cash", currencies: ["JPY"] },
        { type: "open", date: "2024-01-01", account: "Equity:Opening-Balances", currencies: ["JPY"] },
        { type: "pad", date: "2024-01-01", account: "Assets:Cash", padAccount: "Equity:Opening-Balances" },
        { type: "balance", date: "2024-01-10", account: "Assets:Cash", amount: 5000, currency: "JPY" },
      ],
      transactions: [],
    };

    const result = processPadDirectives(ledger);
    expect(isBalanced(result.transactions[0])).toBe(true);
  });
});
