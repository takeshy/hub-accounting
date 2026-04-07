import { describe, it, expect } from "vitest";
import { getDefaultTemplates, buildPostings, applyTemplate, parseArgs } from "./templates";
import { JournalTemplate, AccountingSettings, DEFAULT_SETTINGS } from "../types";
import { createEmptyLedger } from "./ledger";

describe("getDefaultTemplates", () => {
  it("returns an array of templates", () => {
    const templates = getDefaultTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it("each template has required fields", () => {
    for (const tmpl of getDefaultTemplates()) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.narration).toBeTruthy();
      expect(tmpl.postings.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each template has exactly one auto-balance posting (null multiplier)", () => {
    for (const tmpl of getDefaultTemplates()) {
      const nullCount = tmpl.postings.filter((p) => p.multiplier === null).length;
      expect(nullCount).toBe(1);
    }
  });

  it("each template has unique id and name", () => {
    const templates = getDefaultTemplates();
    const ids = templates.map((t) => t.id);
    const names = templates.map((t) => t.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("parseArgs", () => {
  it("parses amount only", () => {
    expect(parseArgs("100000")).toEqual({ amount: 100000 });
  });

  it("parses amount with narration", () => {
    expect(parseArgs("50000 A社からの入金")).toEqual({ amount: 50000, narration: "A社からの入金" });
  });

  it("parses decimal amount", () => {
    expect(parseArgs("123.45")).toEqual({ amount: 123.45 });
  });

  it("returns null for empty string", () => {
    expect(parseArgs("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseArgs("abc")).toBeNull();
  });

  it("returns null for zero", () => {
    expect(parseArgs("0")).toBeNull();
  });

  it("returns null for negative", () => {
    expect(parseArgs("-100")).toBeNull();
  });
});

describe("buildPostings", () => {
  it("applies multiplier to create postings", () => {
    const tplPostings = [
      { account: "Assets:OrdinaryDeposit", multiplier: 1 },
      { account: "Income:Sales", multiplier: null },
    ];
    const postings = buildPostings(tplPostings, 100000, "JPY", 0);

    expect(postings[0].account).toBe("Assets:OrdinaryDeposit");
    expect(postings[0].amount).toBe(100000);
    expect(postings[0].currency).toBe("JPY");

    expect(postings[1].account).toBe("Income:Sales");
    expect(postings[1].amount).toBeNull();
  });

  it("handles negative multipliers", () => {
    const tplPostings = [
      { account: "Expenses:Salary", multiplier: 1 },
      { account: "Liabilities:WithholdingTax", multiplier: -0.1021 },
      { account: "Assets:OrdinaryDeposit", multiplier: null },
    ];
    const postings = buildPostings(tplPostings, 250000, "JPY", 0);

    expect(postings[0].amount).toBe(250000);
    expect(postings[1].amount).toBe(-25525);
    expect(postings[2].amount).toBeNull();
  });

  it("uses custom currency when specified", () => {
    const tplPostings = [
      { account: "Assets:Bank", multiplier: 1, currency: "USD" },
      { account: "Income:Sales", multiplier: null },
    ];
    const postings = buildPostings(tplPostings, 1000, "JPY", 2);

    expect(postings[0].currency).toBe("USD");
    expect(postings[1].currency).toBe("JPY");
  });

  it("preserves tax category", () => {
    const tplPostings = [
      { account: "Expenses:Purchases", multiplier: 1, taxCategory: "taxable_10" as const },
      { account: "Assets:Cash", multiplier: null },
    ];
    const postings = buildPostings(tplPostings, 5000, "JPY", 0);

    expect(postings[0].taxCategory).toBe("taxable_10");
    expect(postings[1].taxCategory).toBeUndefined();
  });

  it("rounds amounts according to decimal places", () => {
    const tplPostings = [
      { account: "Expenses:Salary", multiplier: 0.3333 },
      { account: "Assets:Cash", multiplier: null },
    ];

    const postings0 = buildPostings(tplPostings, 10000, "JPY", 0);
    expect(postings0[0].amount).toBe(3333);

    const postings2 = buildPostings(tplPostings, 10000, "USD", 2);
    expect(postings2[0].amount).toBe(3333);
  });
});

describe("applyTemplate", () => {
  const salesTemplate: JournalTemplate = {
    id: "tpl_test",
    name: "テスト売上",
    description: "テスト用売上入金",
    narration: "売上入金",
    postings: [
      { account: "Assets:OrdinaryDeposit", multiplier: 1 },
      { account: "Income:Sales", multiplier: null, taxCategory: "taxable_10" },
    ],
  };

  const settings: AccountingSettings = { ...DEFAULT_SETTINGS, defaultCurrency: "JPY", decimalPlaces: 0 };

  function makeCtx() {
    const ledger = createEmptyLedger("JPY", "japan_sole_proprietor");
    return {
      ledger,
      settings,
      onUpdate: async () => {},
    };
  }

  it("returns usage message for empty args", () => {
    const { result, ledger } = applyTemplate(salesTemplate, "", makeCtx());
    expect(result).toContain("/テスト売上");
    expect(ledger).toBeUndefined();
  });

  it("returns usage message for invalid amount", () => {
    const { result, ledger } = applyTemplate(salesTemplate, "abc", makeCtx());
    expect(result).toContain("/テスト売上");
    expect(ledger).toBeUndefined();
  });

  it("creates a transaction for valid input", () => {
    const { result, ledger } = applyTemplate(salesTemplate, "100000", makeCtx());
    expect(result).toContain("100,000");
    expect(ledger).toBeDefined();

    expect(ledger!.transactions.length).toBe(1);
    const txn = ledger!.transactions[0];
    expect(txn.narration).toBe("売上入金");
    expect(txn.tags).toContain("template");
    expect(txn.postings[0].amount).toBe(100000);
    expect(txn.postings[1].amount).toBe(-100000);
  });

  it("uses custom narration from args", () => {
    const { result, ledger } = applyTemplate(salesTemplate, "50000 A社からの入金", makeCtx());
    expect(result).toContain("A社からの入金");
    expect(ledger!.transactions[0].narration).toBe("A社からの入金");
  });

  it("sets the date to today", () => {
    const { ledger } = applyTemplate(salesTemplate, "10000", makeCtx());
    const today = new Date().toISOString().slice(0, 10);
    expect(ledger!.transactions[0].date).toBe(today);
  });

  it("preserves payee from template", () => {
    const tmpl = { ...salesTemplate, payee: "取引先A" };
    const { ledger } = applyTemplate(tmpl, "10000", makeCtx());
    expect(ledger!.transactions[0].payee).toBe("取引先A");
  });

  it("handles multi-posting templates with proportional amounts", () => {
    const salaryTemplate: JournalTemplate = {
      id: "tpl_salary_test",
      name: "給与テスト",
      description: "テスト給与",
      narration: "給与支払",
      postings: [
        { account: "Expenses:Salary", multiplier: 1 },
        { account: "Liabilities:WithholdingTax", multiplier: -0.1 },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    };

    const { ledger } = applyTemplate(salaryTemplate, "200000", makeCtx());
    expect(ledger).toBeDefined();

    const txn = ledger!.transactions[0];
    expect(txn.postings[0].amount).toBe(200000);     // salary
    expect(txn.postings[1].amount).toBe(-20000);      // withholding
    expect(txn.postings[2].amount).toBe(-180000);     // auto-balance
  });
});
