import { describe, it, expect } from "vitest";
import { checkDuplicates, filterDuplicates, deduplicateBatch } from "./dedup";
import { Transaction } from "../types";

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

describe("checkDuplicates", () => {
  it("detects exact duplicate transactions", () => {
    const existing = [makeTxn()];
    const candidates = [makeTxn({ id: "test-2" })];
    const results = checkDuplicates(existing, candidates);
    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].matchKind).toBe("fingerprint");
  });

  it("does not flag different transactions", () => {
    const existing = [makeTxn()];
    const candidates = [
      makeTxn({ id: "test-2", narration: "Different" }),
    ];
    const results = checkDuplicates(existing, candidates);
    expect(results[0].isDuplicate).toBe(false);
    expect(results[0].matchKind).toBeNull();
  });

  it("does not flag transactions with different amounts", () => {
    const existing = [makeTxn()];
    const candidates = [
      makeTxn({
        id: "test-2",
        postings: [
          { account: "Expenses:Food", amount: 2000, currency: "JPY" },
          { account: "Assets:Cash", amount: -2000, currency: "JPY" },
        ],
      }),
    ];
    const results = checkDuplicates(existing, candidates);
    expect(results[0].isDuplicate).toBe(false);
  });

  it("does not flag transactions with different dates", () => {
    const existing = [makeTxn()];
    const candidates = [makeTxn({ id: "test-2", date: "2024-01-16" })];
    const results = checkDuplicates(existing, candidates);
    expect(results[0].isDuplicate).toBe(false);
  });

  it("detects duplicates ignoring case and whitespace in narration", () => {
    const existing = [makeTxn({ narration: "Lunch at Cafe" })];
    const candidates = [
      makeTxn({ id: "test-2", narration: "lunch  at  cafe" }),
    ];
    const results = checkDuplicates(existing, candidates);
    expect(results[0].isDuplicate).toBe(true);
  });

  it("detects duplicates via metadata key", () => {
    const existing = [
      makeTxn({
        narration: "A",
        metadata: [{ entry: ["import-id", "abc-123"], postingIndex: 0 }],
      }),
    ];
    const candidates = [
      makeTxn({
        id: "test-2",
        narration: "B",
        metadata: [{ entry: ["import-id", "abc-123"], postingIndex: 0 }],
      }),
    ];
    const results = checkDuplicates(existing, candidates, ["import-id"]);
    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].matchKind).toBe("meta-key");
  });

  it("does not match different metadata key values", () => {
    const existing = [
      makeTxn({
        narration: "A",
        metadata: [{ entry: ["import-id", "abc-123"], postingIndex: 0 }],
      }),
    ];
    const candidates = [
      makeTxn({
        id: "test-2",
        narration: "B",
        date: "2024-02-01",
        metadata: [{ entry: ["import-id", "xyz-456"], postingIndex: 0 }],
      }),
    ];
    const results = checkDuplicates(existing, candidates, ["import-id"]);
    expect(results[0].isDuplicate).toBe(false);
  });

  it("handles empty existing transactions", () => {
    const candidates = [makeTxn()];
    const results = checkDuplicates([], candidates);
    expect(results[0].isDuplicate).toBe(false);
  });

  it("handles multiple candidates", () => {
    const existing = [makeTxn()];
    const candidates = [
      makeTxn({ id: "dup" }),
      makeTxn({ id: "new", narration: "New" }),
    ];
    const results = checkDuplicates(existing, candidates);
    expect(results[0].isDuplicate).toBe(true);
    expect(results[1].isDuplicate).toBe(false);
  });
});

describe("filterDuplicates", () => {
  it("returns only non-duplicate transactions", () => {
    const existing = [makeTxn()];
    const candidates = [
      makeTxn({ id: "dup" }),
      makeTxn({ id: "new", narration: "New" }),
    ];
    const filtered = filterDuplicates(existing, candidates);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("new");
  });

  it("returns all when no duplicates", () => {
    const candidates = [
      makeTxn({ id: "a", narration: "A" }),
      makeTxn({ id: "b", narration: "B" }),
    ];
    const filtered = filterDuplicates([], candidates);
    expect(filtered).toHaveLength(2);
  });
});

describe("deduplicateBatch", () => {
  it("removes duplicates within a batch", () => {
    const candidates = [
      makeTxn({ id: "a" }),
      makeTxn({ id: "b", narration: "Different" }),
      makeTxn({ id: "c" }),
    ];
    const { unique, duplicateIndices } = deduplicateBatch(candidates);
    expect(unique).toHaveLength(2);
    expect(duplicateIndices).toEqual([2]);
  });

  it("keeps all when no duplicates", () => {
    const candidates = [
      makeTxn({ id: "a", narration: "A" }),
      makeTxn({ id: "b", narration: "B" }),
    ];
    const { unique, duplicateIndices } = deduplicateBatch(candidates);
    expect(unique).toHaveLength(2);
    expect(duplicateIndices).toEqual([]);
  });

  it("deduplicates by metadata key within batch", () => {
    const candidates = [
      makeTxn({
        id: "a",
        narration: "A",
        metadata: [{ entry: ["import-id", "x"], postingIndex: 0 }],
      }),
      makeTxn({
        id: "b",
        narration: "B",
        metadata: [{ entry: ["import-id", "x"], postingIndex: 0 }],
      }),
    ];
    const { unique, duplicateIndices } = deduplicateBatch(candidates, ["import-id"]);
    expect(unique).toHaveLength(1);
    expect(duplicateIndices).toEqual([1]);
  });
});
