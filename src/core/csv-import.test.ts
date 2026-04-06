import { describe, it, expect } from "vitest";
import {
  parseCSVLine,
  cleanAmount,
  parseDate,
  parseCSV,
  rowToTransaction,
  importRows,
  detectFormat,
  BANK_PRESETS,
} from "./csv-import";
import { createEmptyLedger, isBalanced } from "./ledger";
import { Transaction } from "../types";

describe("parseCSVLine", () => {
  it("splits simple CSV", () => {
    expect(parseCSVLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCSVLine('"field,with,commas",normal', ",")).toEqual([
      "field,with,commas",
      "normal",
    ]);
  });

  it("handles escaped quotes", () => {
    expect(parseCSVLine('"say ""hello""",b', ",")).toEqual(['say "hello"', "b"]);
  });

  it("handles empty fields", () => {
    expect(parseCSVLine("a,,c", ",")).toEqual(["a", "", "c"]);
  });
});

describe("cleanAmount", () => {
  it("removes commas", () => {
    expect(cleanAmount("1,234")).toBe(1234);
  });

  it("removes yen sign", () => {
    expect(cleanAmount("￥5,000")).toBe(5000);
  });

  it("returns 0 for empty", () => {
    expect(cleanAmount("")).toBe(0);
  });

  it("handles plain number", () => {
    expect(cleanAmount("1000")).toBe(1000);
  });

  it("handles full-width digits", () => {
    expect(cleanAmount("１２３")).toBe(123);
  });
});

describe("parseDate", () => {
  it("parses yyyy/MM/dd", () => {
    expect(parseDate("2024/01/15", "yyyy/MM/dd")).toBe("2024-01-15");
  });

  it("parses yyyyMMdd", () => {
    expect(parseDate("20240115", "yyyyMMdd")).toBe("2024-01-15");
  });

  it("parses yyyy-MM-dd passthrough", () => {
    expect(parseDate("2024-01-15", "yyyy-MM-dd")).toBe("2024-01-15");
  });

  it("parses Japanese date format", () => {
    expect(parseDate("2024年1月5日", "yyyy/MM/dd")).toBe("2024-01-05");
  });

  it("pads single-digit month/day", () => {
    expect(parseDate("2024/1/5", "yyyy/MM/dd")).toBe("2024-01-05");
  });
});

describe("detectFormat", () => {
  it("detects yucho", () => {
    expect(detectFormat("取扱日,番号,種別,取引内容,入金額,出金額,残高")).toBe("yucho");
  });

  it("detects smbc", () => {
    expect(detectFormat("年月日,お取引内容,お引出し,お預入れ,残高")).toBe("smbc");
  });

  it("detects creditcard", () => {
    expect(detectFormat("ご利用日,ご利用先,ご利用金額")).toBe("creditcard");
  });

  it("returns null for unknown", () => {
    expect(detectFormat("date,description,amount")).toBeNull();
  });
});

describe("parseCSV", () => {
  const generic = BANK_PRESETS.find((p) => p.id === "generic")!;

  it("parses a simple bank CSV", () => {
    const text = [
      "日付,摘要,出金,入金,残高",
      "2024/01/15,コンビニ,500,,10000",
      "2024/01/20,給与,,300000,310000",
    ].join("\n");
    const rows = parseCSV(text, generic);
    expect(rows).toHaveLength(2);
    expect(rows[0].date).toBe("2024-01-15");
    expect(rows[0].description).toBe("コンビニ");
    expect(rows[0].withdrawal).toBe(500);
    expect(rows[0].deposit).toBe(0);
    expect(rows[0].counterpartAccount).toBe("Expenses:Miscellaneous");
    expect(rows[1].deposit).toBe(300000);
    expect(rows[1].counterpartAccount).toBe("Income:OtherIncome");
  });

  it("skips header rows", () => {
    const text = "header\n2024/01/15,test,100,,";
    const rows = parseCSV(text, generic);
    expect(rows).toHaveLength(1);
  });

  it("skips rows with zero amounts", () => {
    const text = "header\n2024/01/15,test,0,0,0";
    const rows = parseCSV(text, generic);
    expect(rows).toHaveLength(0);
  });
});

describe("rowToTransaction", () => {
  it("creates balanced withdrawal transaction", () => {
    const txn = rowToTransaction(
      { rowIndex: 1, date: "2024-01-15", description: "コンビニ", withdrawal: 500, deposit: 0, counterpartAccount: "Expenses:Supplies", enabled: true },
      "Assets:OrdinaryDeposit",
      "JPY"
    );
    expect(txn.postings[0].account).toBe("Expenses:Supplies");
    expect(txn.postings[0].amount).toBe(500);
    expect(txn.postings[1].account).toBe("Assets:OrdinaryDeposit");
    expect(txn.postings[1].amount).toBe(-500);
    expect(isBalanced(txn as Transaction)).toBe(true);
  });

  it("creates balanced deposit transaction", () => {
    const txn = rowToTransaction(
      { rowIndex: 1, date: "2024-01-20", description: "給与", withdrawal: 0, deposit: 300000, counterpartAccount: "Income:Sales", enabled: true },
      "Assets:OrdinaryDeposit",
      "JPY"
    );
    expect(txn.postings[0].account).toBe("Assets:OrdinaryDeposit");
    expect(txn.postings[0].amount).toBe(300000);
    expect(txn.postings[1].account).toBe("Income:Sales");
    expect(txn.postings[1].amount).toBe(-300000);
    expect(isBalanced(txn as Transaction)).toBe(true);
  });

  it("adds csv-import tag", () => {
    const txn = rowToTransaction(
      { rowIndex: 1, date: "2024-01-15", description: "test", withdrawal: 100, deposit: 0, counterpartAccount: "Expenses:Miscellaneous", enabled: true },
      "Assets:Cash",
      "JPY"
    );
    expect(txn.tags).toContain("csv-import");
  });
});

describe("importRows", () => {
  it("imports enabled rows into ledger", () => {
    const ledger = createEmptyLedger("JPY", "japan_sole_proprietor");
    const rows = [
      { rowIndex: 1, date: "2024-01-15", description: "A", withdrawal: 100, deposit: 0, counterpartAccount: "Expenses:Supplies", enabled: true },
      { rowIndex: 2, date: "2024-01-16", description: "B", withdrawal: 200, deposit: 0, counterpartAccount: "Expenses:Rent", enabled: true },
      { rowIndex: 3, date: "2024-01-17", description: "C", withdrawal: 300, deposit: 0, counterpartAccount: "Expenses:Fees", enabled: false },
    ];
    const result = importRows(ledger, rows, "Assets:OrdinaryDeposit", "JPY");
    expect(result.transactions).toHaveLength(2);
  });

  it("skips disabled rows", () => {
    const ledger = createEmptyLedger("JPY", "japan_sole_proprietor");
    const rows = [
      { rowIndex: 1, date: "2024-01-15", description: "skip", withdrawal: 100, deposit: 0, counterpartAccount: "Expenses:Supplies", enabled: false },
    ];
    const result = importRows(ledger, rows, "Assets:OrdinaryDeposit", "JPY");
    expect(result.transactions).toHaveLength(0);
  });

  it("sorts transactions by date", () => {
    const ledger = createEmptyLedger("JPY", "japan_sole_proprietor");
    const rows = [
      { rowIndex: 1, date: "2024-02-01", description: "Feb", withdrawal: 100, deposit: 0, counterpartAccount: "Expenses:Supplies", enabled: true },
      { rowIndex: 2, date: "2024-01-01", description: "Jan", withdrawal: 200, deposit: 0, counterpartAccount: "Expenses:Supplies", enabled: true },
    ];
    const result = importRows(ledger, rows, "Assets:OrdinaryDeposit", "JPY");
    expect(result.transactions[0].narration).toBe("Jan");
    expect(result.transactions[1].narration).toBe("Feb");
  });
});
