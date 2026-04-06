import { describe, it, expect } from "vitest";
import { parse } from "./parser";
import { format } from "./formatter";

describe("formatter", () => {
  it("preserves comments and directive order on round-trip", () => {
    const text = [
      "; opening note",
      'option "operating_currency" "JPY"',
      "2024-01-01 open Assets:Cash JPY",
      "2024-01-02 balance Assets:Cash 0 JPY",
      '; transaction note',
      '2024-01-03 * "Lunch"',
      "  Expenses:Food  800 JPY",
      "  Assets:Cash  -800 JPY",
      "2024-01-04 close Assets:Cash",
    ].join("\n");

    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("formats pending transaction with ! flag", () => {
    const text = [
      '2024-02-01 ! "Pending payment"',
      "  Expenses:Other  1,000 JPY",
      "  Assets:Cash  -1,000 JPY",
    ].join("\n");
    const result = format(parse(text), 0);
    expect(result).toContain('2024-02-01 ! "Pending payment"');
  });

  it("formats auto-balanced posting (null amount)", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      "  Expenses:Food  800 JPY",
      "  Assets:Cash",
    ].join("\n");
    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("formats with decimal places", () => {
    const text = [
      '2024-01-15 * "Coffee"',
      "  Expenses:Food  4.50 USD",
      "  Assets:Cash  -4.50 USD",
    ].join("\n");
    const result = format(parse(text), 2);
    expect(result).toContain("4.50 USD");
    expect(result).toContain("-4.50 USD");
  });

  it("formats transaction with payee and narration", () => {
    const text = [
      '2024-01-15 * "Shop" "Groceries"',
      "  Expenses:Food  500 JPY",
      "  Assets:Cash  -500 JPY",
    ].join("\n");
    const result = format(parse(text), 0);
    expect(result).toContain('"Shop" "Groceries"');
  });

  it("formats tags and links", () => {
    const text = [
      '2024-01-15 * "Trip" #travel ^trip-2024',
      "  Expenses:Transport  10,000 JPY",
      "  Assets:Bank  -10,000 JPY",
    ].join("\n");
    const result = format(parse(text), 0);
    expect(result).toContain("#travel");
    expect(result).toContain("^trip-2024");
  });

  it("preserves transaction-level metadata on round-trip", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      '  document: "receipt.pdf"',
      "  Expenses:Food  800 JPY",
      "  Assets:Cash  -800 JPY",
    ].join("\n");
    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("preserves posting-level metadata on round-trip", () => {
    const text = [
      '2024-01-01 * "x"',
      "  Assets:Cash  -100 JPY",
      "    note: cash leg",
      "  Expenses:Food  100 JPY",
    ].join("\n");
    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("preserves duplicate metadata keys", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      '  tag: first',
      '  tag: second',
      "  Expenses:Food  800 JPY",
      "  Assets:Cash  -800 JPY",
    ].join("\n");
    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("does not move posting metadata to transaction level", () => {
    const text = [
      '2024-01-01 * "x"',
      "  Assets:Cash  -100 JPY",
      "    note: cash leg",
      "  Expenses:Food  100 JPY",
    ].join("\n");
    const ledger = parse(text);
    const txn = ledger.transactions[0];
    // Should NOT have transaction-level metadata
    expect(txn.metadata).toBeUndefined();
    // Should have posting-level metadata on first posting
    expect(txn.postings[0].metadata).toEqual([["note", "cash leg"]]);
  });

  it("keeps transaction metadata at two-space indentation even after a posting", () => {
    const text = [
      '2024-01-01 * "x"',
      "  Assets:Cash  -100 JPY",
      "  note: txn-level",
      "  Expenses:Food  100 JPY",
    ].join("\n");
    const ledger = parse(text);
    const txn = ledger.transactions[0];
    expect(txn.metadata).toEqual([{ entry: ["note", "txn-level"], postingIndex: 1 }]);
    expect(txn.postings[0].metadata).toBeUndefined();
    expect(format(ledger, 0)).toBe(text + "\n");
  });

  it("formats empty ledger", () => {
    const result = format(parse(""), 0);
    expect(result).toBe("\n");
  });

  it("formats open directive with multiple currencies", () => {
    const text = "2024-01-01 open Assets:Bank JPY,USD";
    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("formats pad directive", () => {
    const text = "2024-01-01 pad Assets:Bank Equity:Opening-Balances";
    expect(format(parse(text), 0)).toBe(text + "\n");
  });

  it("formats commodity directive", () => {
    const text = "2024-01-01 commodity JPY";
    expect(format(parse(text), 0)).toBe(text + "\n");
  });
});
