import { describe, it, expect } from "vitest";
import { parse } from "./parser";

describe("parser", () => {
  it("parses option directives", () => {
    const text = `option "operating_currency" "JPY"`;
    const result = parse(text);
    expect(result.options["operating_currency"]).toBe("JPY");
    expect(result.directives[0]).toEqual({
      type: "option",
      key: "operating_currency",
      value: "JPY",
    });
  });

  it("parses open directives", () => {
    const text = `2024-01-01 open Assets:Bank:Checking JPY`;
    const result = parse(text);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toEqual({
      name: "Assets:Bank:Checking",
      type: "Assets",
      openDate: "2024-01-01",
      currencies: ["JPY"],
    });
  });

  it("parses open directive with multiple currencies", () => {
    const text = `2024-01-01 open Assets:Bank JPY,USD`;
    const result = parse(text);
    expect(result.accounts[0].currencies).toEqual(["JPY", "USD"]);
  });

  it("parses close directives", () => {
    const text = [
      "2024-01-01 open Assets:OldAccount JPY",
      "2024-06-30 close Assets:OldAccount",
    ].join("\n");
    const result = parse(text);
    expect(result.accounts[0].closeDate).toBe("2024-06-30");
  });

  it("parses a simple transaction", () => {
    const text = [
      '2024-01-15 * "Supermarket" "Groceries"',
      "  Expenses:Food  5000 JPY",
      "  Assets:Bank:Checking  -5000 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions).toHaveLength(1);
    const txn = result.transactions[0];
    expect(txn.date).toBe("2024-01-15");
    expect(txn.flag).toBe("*");
    expect(txn.payee).toBe("Supermarket");
    expect(txn.narration).toBe("Groceries");
    expect(txn.postings).toHaveLength(2);
    expect(txn.postings[0]).toEqual({
      account: "Expenses:Food",
      amount: 5000,
      currency: "JPY",
    });
    expect(txn.postings[1]).toEqual({
      account: "Assets:Bank:Checking",
      amount: -5000,
      currency: "JPY",
    });
  });

  it("parses transaction with single narration (no payee)", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      "  Expenses:Food  800 JPY",
      "  Assets:Cash  -800 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].narration).toBe("Lunch");
    expect(result.transactions[0].payee).toBeUndefined();
  });

  it("parses pending transaction (! flag)", () => {
    const text = [
      '2024-02-01 ! "Pending payment"',
      "  Expenses:Other  1000 JPY",
      "  Assets:Bank:Checking  -1000 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].flag).toBe("!");
  });

  it("parses transaction with auto-balanced posting (null amount)", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      "  Expenses:Food  800 JPY",
      "  Assets:Cash",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].postings[1].amount).toBeNull();
  });

  it("parses tags and links", () => {
    const text = [
      '2024-01-15 * "Trip" #travel ^trip-2024',
      "  Expenses:Transport  10000 JPY",
      "  Assets:Bank:Checking  -10000 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].tags).toContain("travel");
    expect(result.transactions[0].links).toContain("trip-2024");
  });

  it("parses balance directive", () => {
    const text = `2024-01-31 balance Assets:Bank:Checking 100000 JPY`;
    const result = parse(text);
    expect(result.directives[0]).toEqual({
      type: "balance",
      date: "2024-01-31",
      account: "Assets:Bank:Checking",
      amount: 100000,
      currency: "JPY",
    });
  });

  it("parses pad directive", () => {
    const text = `2024-01-01 pad Assets:Bank:Checking Equity:Opening-Balances`;
    const result = parse(text);
    expect(result.directives[0]).toEqual({
      type: "pad",
      date: "2024-01-01",
      account: "Assets:Bank:Checking",
      padAccount: "Equity:Opening-Balances",
    });
  });

  it("parses commodity directive", () => {
    const text = `2024-01-01 commodity JPY`;
    const result = parse(text);
    expect(result.directives[0]).toEqual({
      type: "commodity",
      date: "2024-01-01",
      currency: "JPY",
    });
  });

  it("skips comments", () => {
    const text = [
      "; This is a comment",
      '2024-01-15 * "Test"',
      "  Expenses:Food  100 JPY",
      "  Assets:Cash  -100 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions).toHaveLength(1);
  });

  it("parses a complete ledger", () => {
    const text = [
      'option "operating_currency" "JPY"',
      "",
      "2024-01-01 open Assets:Bank:Checking JPY",
      "2024-01-01 open Expenses:Food JPY",
      "2024-01-01 open Income:Salary JPY",
      "",
      '2024-01-25 * "Company" "Salary"',
      "  Assets:Bank:Checking  300000 JPY",
      "  Income:Salary  -300000 JPY",
      "",
      '2024-01-26 * "Supermarket" "Groceries"',
      "  Expenses:Food  5000 JPY",
      "  Assets:Bank:Checking  -5000 JPY",
    ].join("\n");

    const result = parse(text);
    expect(result.options["operating_currency"]).toBe("JPY");
    expect(result.accounts).toHaveLength(3);
    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("reports errors for invalid account types", () => {
    const text = `2024-01-01 open Invalid:Account JPY`;
    const result = parse(text);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].severity).toBe("error");
  });

  it("handles amounts with commas", () => {
    const text = [
      '2024-01-25 * "Salary"',
      "  Assets:Bank  1,000,000 JPY",
      "  Income:Salary  -1,000,000 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].postings[0].amount).toBe(1000000);
  });

  it("parses tax-category metadata into taxCategory field", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      "  Expenses:Food  1080 JPY",
      "    tax-category: taxable_8",
      "  Assets:Cash  -1080 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].postings[0].taxCategory).toBe("taxable_8");
    // tax-category should be removed from metadata
    expect(result.transactions[0].postings[0].metadata).toBeUndefined();
  });

  it("preserves other metadata alongside tax-category", () => {
    const text = [
      '2024-01-15 * "Lunch"',
      "  Expenses:Food  1080 JPY",
      "    tax-category: taxable_10",
      "    note: receipt",
      "  Assets:Cash  -1080 JPY",
    ].join("\n");
    const result = parse(text);
    const p = result.transactions[0].postings[0];
    expect(p.taxCategory).toBe("taxable_10");
    expect(p.metadata).toEqual([["note", "receipt"]]);
  });

  it("ignores invalid tax-category value", () => {
    const text = [
      '2024-01-15 * "Test"',
      "  Expenses:Food  100 JPY",
      "    tax-category: invalid_value",
      "  Assets:Cash  -100 JPY",
    ].join("\n");
    const result = parse(text);
    expect(result.transactions[0].postings[0].taxCategory).toBeUndefined();
  });
});
