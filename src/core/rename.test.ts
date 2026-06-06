import { describe, it, expect } from "vitest";
import {
  rename,
  renameAccount,
  renameTag,
  renameLink,
  renameCurrency,
  isValidAccountName,
  isValidTagLinkName,
  isValidCurrencyName,
} from "./rename";
import { createEmptyLedger, addTransaction } from "./ledger";

describe("isValidAccountName", () => {
  it("accepts valid account names", () => {
    expect(isValidAccountName("Assets:Cash")).toBe(true);
    expect(isValidAccountName("Expenses:Food:Groceries")).toBe(true);
    expect(isValidAccountName("Liabilities:Credit-Card")).toBe(true);
  });

  it("rejects invalid account names", () => {
    expect(isValidAccountName("Cash")).toBe(false);
    expect(isValidAccountName("Invalid:Cash")).toBe(false);
    expect(isValidAccountName("Assets:")).toBe(false);
    expect(isValidAccountName("Assets:123")).toBe(false);
  });
});

describe("isValidTagLinkName", () => {
  it("accepts valid tag/link names", () => {
    expect(isValidTagLinkName("travel")).toBe(true);
    expect(isValidTagLinkName("invoice-001")).toBe(true);
    expect(isValidTagLinkName("project.alpha")).toBe(true);
  });

  it("rejects invalid tag/link names", () => {
    expect(isValidTagLinkName("")).toBe(false);
    expect(isValidTagLinkName("has space")).toBe(false);
    expect(isValidTagLinkName("special!char")).toBe(false);
  });
});

describe("isValidCurrencyName", () => {
  it("accepts valid currency names", () => {
    expect(isValidCurrencyName("JPY")).toBe(true);
    expect(isValidCurrencyName("USD")).toBe(true);
    expect(isValidCurrencyName("BTC")).toBe(true);
  });

  it("rejects invalid currency names", () => {
    expect(isValidCurrencyName("jpy")).toBe(false);
    expect(isValidCurrencyName("1BTC")).toBe(false);
    expect(isValidCurrencyName("")).toBe(false);
  });
});

describe("renameAccount", () => {
  it("renames account in transactions", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Test",
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const result = renameAccount(ledger, "Expenses:Food", "Expenses:Groceries");
    expect(result.ledger.transactions[0].postings[0].account).toBe("Expenses:Groceries");
    expect(result.changedCount).toBeGreaterThan(0);
  });

  it("renames hierarchical accounts", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Test",
      postings: [
        { account: "Expenses:Food:Groceries", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const result = renameAccount(ledger, "Expenses:Food", "Expenses:Meals");
    expect(result.ledger.transactions[0].postings[0].account).toBe("Expenses:Meals:Groceries");
  });

  it("renames account in open directives", () => {
    const ledger = createEmptyLedger("JPY");
    const result = renameAccount(ledger, "Assets:Cash", "Assets:PettyCash");
    const openDir = result.ledger.directives.find(
      (d) => d.type === "open" && d.account === "Assets:PettyCash"
    );
    expect(openDir).toBeDefined();
  });

  it("renames account in note and document directives", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push(
      { type: "note", date: "2024-01-01", account: "Assets:Cash", comment: "Memo" },
      { type: "document", date: "2024-01-02", account: "Assets:Cash", path: "receipt.pdf" }
    );
    const result = renameAccount(ledger, "Assets:Cash", "Assets:PettyCash");
    expect(result.ledger.directives).toContainEqual({
      type: "note",
      date: "2024-01-01",
      account: "Assets:PettyCash",
      comment: "Memo",
    });
    expect(result.ledger.directives).toContainEqual({
      type: "document",
      date: "2024-01-02",
      account: "Assets:PettyCash",
      path: "receipt.pdf",
    });
  });

  it("rejects renaming an account to an existing account", () => {
    const ledger = createEmptyLedger("JPY");
    expect(() => renameAccount(ledger, "Assets:Cash", "Assets:Bank")).toThrow(
      /duplicate account/
    );
  });

  it("counts each account reference once", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Test",
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const result = renameAccount(ledger, "Expenses:Food", "Expenses:Groceries");
    expect(result.changedCount).toBe(2);
  });

  it("throws on invalid new name", () => {
    const ledger = createEmptyLedger("JPY");
    expect(() => renameAccount(ledger, "Assets:Cash", "Invalid")).toThrow();
  });
});

describe("renameTag", () => {
  it("renames tag across transactions", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Trip",
      postings: [
        { account: "Expenses:Travel", amount: 10000, currency: "JPY" },
        { account: "Assets:Cash", amount: -10000, currency: "JPY" },
      ],
      tags: ["travel", "2024"],
      links: [],
    });
    ledger = addTransaction(ledger, {
      date: "2024-01-02",
      flag: "*",
      narration: "Hotel",
      postings: [
        { account: "Expenses:Travel", amount: 5000, currency: "JPY" },
        { account: "Assets:Cash", amount: -5000, currency: "JPY" },
      ],
      tags: ["travel"],
      links: [],
    });
    const result = renameTag(ledger, "travel", "trip");
    expect(result.ledger.transactions[0].tags).toContain("trip");
    expect(result.ledger.transactions[0].tags).not.toContain("travel");
    expect(result.ledger.transactions[1].tags).toContain("trip");
    expect(result.changedCount).toBe(2);
  });

  it("throws on invalid new name", () => {
    const ledger = createEmptyLedger("JPY");
    expect(() => renameTag(ledger, "old", "invalid name")).toThrow();
  });

  it("rejects renaming a tag to an existing tag", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Trip",
      postings: [
        { account: "Expenses:Travel", amount: 10000, currency: "JPY" },
        { account: "Assets:Cash", amount: -10000, currency: "JPY" },
      ],
      tags: ["travel"],
      links: [],
    });
    ledger = addTransaction(ledger, {
      date: "2024-01-02",
      flag: "*",
      narration: "Work",
      postings: [
        { account: "Expenses:Travel", amount: 5000, currency: "JPY" },
        { account: "Assets:Cash", amount: -5000, currency: "JPY" },
      ],
      tags: ["work"],
      links: [],
    });
    expect(() => renameTag(ledger, "travel", "work")).toThrow(/duplicate tag/);
  });

  it("renames tags in note and document directives", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push(
      { type: "note", date: "2024-01-01", account: "Assets:Cash", comment: "Memo", tags: ["review"] },
      { type: "document", date: "2024-01-02", account: "Assets:Cash", path: "receipt.pdf", tags: ["review"] }
    );
    const result = renameTag(ledger, "review", "checked");
    const note = result.ledger.directives.find((d) => d.type === "note" && d.comment === "Memo");
    const document = result.ledger.directives.find((d) => d.type === "document" && d.path === "receipt.pdf");
    expect(note?.type === "note" ? note.tags : undefined).toEqual(["checked"]);
    expect(document?.type === "document" ? document.tags : undefined).toEqual(["checked"]);
    expect(result.changedCount).toBe(2);
  });

  it("detects tag rename conflicts in note and document directives", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push(
      { type: "note", date: "2024-01-01", account: "Assets:Cash", comment: "Memo", tags: ["review"] },
      { type: "document", date: "2024-01-02", account: "Assets:Cash", path: "receipt.pdf", tags: ["checked"] }
    );
    expect(() => renameTag(ledger, "review", "checked")).toThrow(/duplicate tag/);
  });
});

describe("renameLink", () => {
  it("renames link across transactions", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Invoice",
      postings: [
        { account: "Income:Sales", amount: -10000, currency: "JPY" },
        { account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      tags: [],
      links: ["invoice-001"],
    });
    const result = renameLink(ledger, "invoice-001", "inv-2024-001");
    expect(result.ledger.transactions[0].links).toContain("inv-2024-001");
    expect(result.ledger.transactions[0].links).not.toContain("invoice-001");
  });

  it("rejects renaming a link to an existing link", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Invoice",
      postings: [
        { account: "Income:Sales", amount: -10000, currency: "JPY" },
        { account: "Assets:Cash", amount: 10000, currency: "JPY" },
      ],
      tags: [],
      links: ["invoice-001", "invoice-002"],
    });
    expect(() => renameLink(ledger, "invoice-001", "invoice-002")).toThrow(/duplicate link/);
  });

  it("renames links in note and document directives", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push(
      { type: "note", date: "2024-01-01", account: "Assets:Cash", comment: "Memo", links: ["note-001"] },
      { type: "document", date: "2024-01-02", account: "Assets:Cash", path: "receipt.pdf", links: ["note-001"] }
    );
    const result = renameLink(ledger, "note-001", "doc-001");
    const note = result.ledger.directives.find((d) => d.type === "note" && d.comment === "Memo");
    const document = result.ledger.directives.find((d) => d.type === "document" && d.path === "receipt.pdf");
    expect(note?.type === "note" ? note.links : undefined).toEqual(["doc-001"]);
    expect(document?.type === "document" ? document.links : undefined).toEqual(["doc-001"]);
    expect(result.changedCount).toBe(2);
  });

  it("detects link rename conflicts in note and document directives", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push(
      { type: "note", date: "2024-01-01", account: "Assets:Cash", comment: "Memo", links: ["note-001"] },
      { type: "document", date: "2024-01-02", account: "Assets:Cash", path: "receipt.pdf", links: ["doc-001"] }
    );
    expect(() => renameLink(ledger, "note-001", "doc-001")).toThrow(/duplicate link/);
  });
});

describe("renameCurrency", () => {
  it("renames currency in postings", () => {
    let ledger = createEmptyLedger("JPY");
    ledger = addTransaction(ledger, {
      date: "2024-01-01",
      flag: "*",
      narration: "Test",
      postings: [
        { account: "Expenses:Food", amount: 1000, currency: "JPY" },
        { account: "Assets:Cash", amount: -1000, currency: "JPY" },
      ],
      tags: [],
      links: [],
    });
    const result = renameCurrency(ledger, "JPY", "YEN");
    expect(result.ledger.transactions[0].postings[0].currency).toBe("YEN");
    expect(result.ledger.transactions[0].postings[1].currency).toBe("YEN");
  });

  it("renames currency in account definitions", () => {
    const ledger = createEmptyLedger("JPY");
    const result = renameCurrency(ledger, "JPY", "YEN");
    expect(result.ledger.accounts[0].currencies).toContain("YEN");
  });

  it("rejects renaming a currency to an existing currency", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push({ type: "commodity", date: "2024-01-01", currency: "USD" });
    expect(() => renameCurrency(ledger, "JPY", "USD")).toThrow(/merge existing currency/);
  });

  it("throws on invalid new name", () => {
    const ledger = createEmptyLedger("JPY");
    expect(() => renameCurrency(ledger, "JPY", "jpy")).toThrow();
  });
});

describe("rename (unified)", () => {
  it("dispatches to correct handler", () => {
    const ledger = createEmptyLedger("JPY");
    const result = rename(ledger, "account", "Assets:Cash", "Assets:PettyCash");
    expect(result.ledger.accounts.some((a) => a.name === "Assets:PettyCash")).toBe(true);
  });

  it("throws on unknown target", () => {
    const ledger = createEmptyLedger("JPY");
    expect(() => rename(ledger, "unknown" as any, "a", "b")).toThrow();
  });
});
