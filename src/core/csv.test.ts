import { describe, it, expect } from "vitest";
import { exportFreeeCSV } from "./csv";
import { addTransaction, createEmptyLedger } from "./ledger";

// Simple i18n mock that returns Japanese account names
function mockT(key: string): string {
  const map: Record<string, string> = {
    "account.Assets:Cash": "現金",
    "account.Income:Sales": "売上高",
    "account.Expenses:Supplies": "消耗品費",
  };
  return map[key] || key;
}

describe("exportFreeeCSV", () => {
  it("generates correct CSV header", () => {
    const l = createEmptyLedger("JPY", "japan_sole_proprietor");
    const csv = exportFreeeCSV(l, "", "9999-12-31", "JPY", mockT);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "取引日,借方勘定科目,借方補助科目,借方税区分,借方金額,貸方勘定科目,貸方補助科目,貸方税区分,貸方金額,摘要"
    );
  });

  it("exports a simple transaction", () => {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      narration: "Office supplies",
      postings: [
        { account: "Expenses:Supplies", amount: 1100, currency: "JPY", taxCategory: "taxable_10" },
        { account: "Assets:Cash", amount: -1100, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    const csv = exportFreeeCSV(l, "", "9999-12-31", "JPY", mockT);
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(2); // header + 1 row

    const row = lines[1].split(",");
    expect(row[0]).toBe("2024-01-15");        // date
    expect(row[1]).toBe("消耗品費");           // debit account
    expect(row[3]).toBe("課対仕入10%");        // debit tax
    expect(row[4]).toBe("1100");               // debit amount
    expect(row[5]).toBe("現金");               // credit account
    expect(row[7]).toBe("対象外");             // credit tax (no category)
    expect(row[8]).toBe("1100");               // credit amount
    expect(row[9]).toBe("Office supplies");    // narration
  });

  it("maps taxable_8 to reduced rate label", () => {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      narration: "Food",
      postings: [
        { account: "Expenses:Supplies", amount: 1080, currency: "JPY", taxCategory: "taxable_8" },
        { account: "Assets:Cash", amount: -1080, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    const csv = exportFreeeCSV(l, "", "9999-12-31", "JPY", mockT);
    const row = csv.trim().split("\n")[1];
    expect(row).toContain("課対仕入8%(軽)");
  });

  it("maps income taxCategory to sales tax label", () => {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      narration: "Service",
      postings: [
        { account: "Assets:Cash", amount: 11000, currency: "JPY" },
        { account: "Income:Sales", amount: -11000, currency: "JPY", taxCategory: "taxable_10" },
      ],
      tags: [],
      links: [],
    });

    const csv = exportFreeeCSV(l, "", "9999-12-31", "JPY", mockT);
    const row = csv.trim().split("\n")[1];
    expect(row).toContain("課税売上10%");
  });

  it("filters by date range", () => {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      narration: "Jan",
      postings: [
        { account: "Expenses:Supplies", amount: 100, currency: "JPY" },
        { account: "Assets:Cash", amount: -100, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    l = addTransaction(l, {
      date: "2024-02-15",
      flag: "*",
      narration: "Feb",
      postings: [
        { account: "Expenses:Supplies", amount: 200, currency: "JPY" },
        { account: "Assets:Cash", amount: -200, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    const csv = exportFreeeCSV(l, "2024-02-01", "2024-02-28", "JPY", mockT);
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(2); // header + 1 row
    expect(lines[1]).toContain("Feb");
  });

  it("includes payee in narration", () => {
    let l = createEmptyLedger("JPY", "japan_sole_proprietor");
    l = addTransaction(l, {
      date: "2024-01-15",
      flag: "*",
      payee: "Amazon",
      narration: "Books",
      postings: [
        { account: "Expenses:Supplies", amount: 500, currency: "JPY" },
        { account: "Assets:Cash", amount: -500, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });

    const csv = exportFreeeCSV(l, "", "9999-12-31", "JPY", mockT);
    expect(csv).toContain("Amazon Books");
  });
});
