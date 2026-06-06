import { describe, it, expect } from "vitest";
import {
  collectAccounts,
  collectCurrencies,
  collectTags,
  collectLinks,
  collectPayees,
  collectNarrations,
  collectMetadataKeys,
  filterCandidates,
  getCompletionCandidates,
} from "./completion";
import { createEmptyLedger, addTransaction } from "./ledger";

describe("collectAccounts", () => {
  it("collects open accounts", () => {
    const ledger = createEmptyLedger("JPY");
    const candidates = collectAccounts(ledger);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.kind === "account")).toBe(true);
    expect(candidates.some((c) => c.label === "Assets:Cash")).toBe(true);
  });

  it("excludes closed accounts", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.accounts[0].closeDate = "2024-12-31";
    const candidates = collectAccounts(ledger);
    expect(candidates.find((c) => c.label === ledger.accounts[0].name)).toBeUndefined();
  });
});

describe("collectCurrencies", () => {
  it("collects currencies from accounts", () => {
    const ledger = createEmptyLedger("JPY");
    const candidates = collectCurrencies(ledger);
    expect(candidates.some((c) => c.label === "JPY")).toBe(true);
  });

  it("collects currencies from commodity directives", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push({ type: "commodity", date: "2024-01-01", currency: "USD" });
    const candidates = collectCurrencies(ledger);
    expect(candidates.some((c) => c.label === "USD")).toBe(true);
  });
});

describe("collectTags", () => {
  it("collects tags with frequency count", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "A",
      postings: [
        { account: "Expenses:Food", amount: 100, currency: "JPY" },
        { account: "Assets:Cash", amount: -100, currency: "JPY" },
      ],
      tags: ["travel", "food"],
      links: [],
    });
    ledger = addTransaction(ledger, {
      date: "2024-01-02",
      flag: "*",
      narration: "B",
      postings: [
        { account: "Expenses:Food", amount: 200, currency: "JPY" },
        { account: "Assets:Cash", amount: -200, currency: "JPY" },
      ],
      tags: ["travel"],
      links: [],
    });
    const candidates = collectTags(ledger);
    const travel = candidates.find((c) => c.label === "travel");
    expect(travel?.count).toBe(2);
    const food = candidates.find((c) => c.label === "food");
    expect(food?.count).toBe(1);
  });

  it("sorts by frequency descending", () => {
    let ledger = createEmptyLedger("JPY");
    for (let i = 0; i < 3; i++) {
      ledger = addTransaction(ledger, {
        date: `2024-01-0${i + 1}`,
        flag: "*",
        narration: `T${i}`,
        postings: [
          { account: "Expenses:Food", amount: 100, currency: "JPY" },
          { account: "Assets:Cash", amount: -100, currency: "JPY" },
        ],
        tags: i < 2 ? ["frequent"] : ["rare"],
        links: [],
      });
    }
    const candidates = collectTags(ledger);
    expect(candidates[0].label).toBe("frequent");
  });
});

describe("collectLinks", () => {
  it("collects links with frequency count", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "A",
      postings: [
        { account: "Expenses:Food", amount: 100, currency: "JPY" },
        { account: "Assets:Cash", amount: -100, currency: "JPY" },
      ],
      tags: [],
      links: ["invoice-001"],
    });
    const candidates = collectLinks(ledger);
    expect(candidates[0].label).toBe("invoice-001");
    expect(candidates[0].count).toBe(1);
  });
});

describe("collectPayees", () => {
  it("collects payees with frequency count", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      payee: "Amazon",
      narration: "Books",
      postings: [
        { account: "Expenses:Supplies", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    ledger = addTransaction(ledger, {
      date: "2024-01-02",
      flag: "*",
      payee: "Amazon",
      narration: "Electronics",
      postings: [
        { account: "Expenses:Supplies", amount: 5000, currency: "JPY" },
        { account: "Assets:Cash", amount: -5000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const candidates = collectPayees(ledger);
    const amazon = candidates.find((c) => c.label === "Amazon");
    expect(amazon?.count).toBe(2);
  });
});

describe("collectNarrations", () => {
  it("collects narrations with frequency count", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Lunch",
      postings: [
        { account: "Expenses:Food", amount: 800, currency: "JPY" },
        { account: "Assets:Cash", amount: -800, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const candidates = collectNarrations(ledger);
    expect(candidates.some((c) => c.label === "Lunch")).toBe(true);
  });

  it("filters by payee", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      payee: "Amazon",
      narration: "Books",
      postings: [
        { account: "Expenses:Supplies", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    ledger = addTransaction(ledger, {
      date: "2024-01-02",
      flag: "*",
      payee: "Other",
      narration: "Misc",
      postings: [
        { account: "Expenses:Other", amount: 500, currency: "JPY" },
        { account: "Assets:Cash", amount: -500, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const candidates = collectNarrations(ledger, "Amazon");
    expect(candidates.some((c) => c.label === "Books")).toBe(true);
    expect(candidates.some((c) => c.label === "Misc")).toBe(false);
  });
});

describe("collectMetadataKeys", () => {
  it("collects metadata keys from transactions and postings", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Test",
      postings: [
        { account: "Expenses:Food", amount: 1080, currency: "JPY", metadata: [["tax-category", "taxable_8"]] },
        { account: "Assets:Cash", amount: -1080, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const candidates = collectMetadataKeys(ledger);
    expect(candidates.some((c) => c.label === "tax-category")).toBe(true);
  });
});

describe("filterCandidates", () => {
  it("filters by prefix case-insensitively", () => {
    const candidates = [
      { label: "Assets:Cash", kind: "account" as const },
      { label: "Assets:Bank", kind: "account" as const },
      { label: "Expenses:Food", kind: "account" as const },
    ];
    const filtered = filterCandidates(candidates, "assets");
    expect(filtered).toHaveLength(2);
  });

  it("returns all when prefix is empty", () => {
    const candidates = [
      { label: "A", kind: "account" as const },
      { label: "B", kind: "account" as const },
    ];
    expect(filterCandidates(candidates, "")).toHaveLength(2);
  });
});

describe("getCompletionCandidates", () => {
  it("returns candidates for each context", () => {
    const ledger = createEmptyLedger("JPY");
    expect(getCompletionCandidates(ledger, "account").length).toBeGreaterThan(0);
    expect(getCompletionCandidates(ledger, "currency").length).toBeGreaterThan(0);
  });
});
