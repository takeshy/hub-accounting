import { describe, it, expect } from "vitest";
import { applyClassifyRules, validateRegex, validateRuleSet, ClassifyRule } from "./classify";
import { ParsedRow } from "./csv-import";

function makeRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    rowIndex: 1,
    date: "2024-01-15",
    description: "Test",
    withdrawal: 1000,
    deposit: 0,
    counterpartAccount: "Expenses:Miscellaneous",
    enabled: true,
    ...overrides,
  };
}

describe("applyClassifyRules", () => {
  it("matches by payee regex", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "コンビニ", account: "Expenses:Food" },
    ];
    const rows = [makeRow({ description: "セブンコンビニ" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Food");
  });

  it("matches by narration regex", () => {
    const rules: ClassifyRule[] = [
      { narrationRegex: "給与", account: "Income:Salary" },
    ];
    const rows = [makeRow({ description: "1月給与" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Income:Salary");
  });

  it("first matching rule wins", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "Amazon", account: "Expenses:Supplies" },
      { payeeRegex: "Amaz", account: "Expenses:Other" },
    ];
    const rows = [makeRow({ description: "Amazon Japan" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Supplies");
  });

  it("no match keeps original account", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "Amazon", account: "Expenses:Supplies" },
    ];
    const rows = [makeRow({ description: "楽天" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Miscellaneous");
  });

  it("regex is case-insensitive", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "amazon", account: "Expenses:Supplies" },
    ];
    const rows = [makeRow({ description: "AMAZON JAPAN" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Supplies");
  });

  it("handles multiple rows", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "コンビニ", account: "Expenses:Food" },
      { payeeRegex: "電気", account: "Expenses:Utilities" },
    ];
    const rows = [
      makeRow({ description: "セブンコンビニ" }),
      makeRow({ description: "東京電気" }),
      makeRow({ description: "その他" }),
    ];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Food");
    expect(result[1].counterpartAccount).toBe("Expenses:Utilities");
    expect(result[2].counterpartAccount).toBe("Expenses:Miscellaneous");
  });

  it("returns original rows when no rules", () => {
    const rows = [makeRow()];
    const result = applyClassifyRules(rows, []);
    expect(result[0].counterpartAccount).toBe("Expenses:Miscellaneous");
  });

  it("does not mutate original rows", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "Test", account: "Expenses:Food" },
    ];
    const rows = [makeRow({ description: "Test" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Food");
    expect(rows[0].counterpartAccount).toBe("Expenses:Miscellaneous");
  });

  it("matches with both payee and narration regex (AND)", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "Amazon", narrationRegex: "本", account: "Expenses:Books" },
    ];
    const match = [makeRow({ payee: "Amazon", narration: "本" })];
    const noMatch = [makeRow({ payee: "Amazon", narration: "家電" })];
    expect(applyClassifyRules(match, rules)[0].counterpartAccount).toBe("Expenses:Books");
    expect(applyClassifyRules(noMatch, rules)[0].counterpartAccount).toBe("Expenses:Miscellaneous");
  });

  it("matches payee and narration against separate fields when present", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "Amazon", narrationRegex: "本", account: "Expenses:Books" },
    ];
    const rows = [makeRow({ description: "Amazon 家電", payee: "Amazon", narration: "本" })];
    const result = applyClassifyRules(rows, rules);
    expect(result[0].counterpartAccount).toBe("Expenses:Books");
  });
});

describe("validateRegex", () => {
  it("returns null for valid regex", () => {
    expect(validateRegex("test.*")).toBeNull();
  });

  it("returns error for invalid regex", () => {
    expect(validateRegex("[invalid")).not.toBeNull();
  });
});

describe("validateRuleSet", () => {
  it("returns no errors for valid rules", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "test", account: "Expenses:Food" },
    ];
    expect(validateRuleSet(rules)).toEqual([]);
  });

  it("reports missing regex and account", () => {
    const rules: ClassifyRule[] = [
      { account: "" },
    ];
    const errors = validateRuleSet(rules);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("reports invalid regex", () => {
    const rules: ClassifyRule[] = [
      { payeeRegex: "[bad", account: "Expenses:Food" },
    ];
    const errors = validateRuleSet(rules);
    expect(errors.length).toBeGreaterThan(0);
  });
});
