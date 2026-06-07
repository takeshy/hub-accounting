import { describe, it, expect } from "vitest";
import {
  getDiagnostics,
  groupDiagnostics,
  formatDiagnostic,
  formatDiagnosticSummary,
  hasErrors,
  hasWarnings,
  getDiagnosticCounts,
  toDiagnostic,
  formatLedgerErrorMessage,
} from "./diagnostics";
import { createEmptyLedger, addTransaction } from "./ledger";
import { LedgerData, LedgerError } from "../types";
import { setLanguage } from "../i18n";

describe("toDiagnostic", () => {
  it("converts LedgerError to Diagnostic", () => {
    const error: LedgerError = { message: "Test error", severity: "error", line: 5 };
    const diag = toDiagnostic(error);
    expect(diag.message).toBe("Test error");
    expect(diag.severity).toBe("error");
    expect(diag.line).toBe(5);
    expect(diag.source).toBe("beancount");
  });

  it("maps warning severity correctly", () => {
    const error: LedgerError = { message: "Test", severity: "warning" };
    const diag = toDiagnostic(error);
    expect(diag.severity).toBe("warning");
  });
});

describe("getDiagnostics", () => {
  it("returns empty array for clean ledger", () => {
    const ledger = createEmptyLedger("JPY");
    const diags = getDiagnostics(ledger);
    expect(diags).toHaveLength(0);
  });

  it("returns diagnostics for ledger with errors", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      errors: [
        { message: "Error 1", severity: "error" },
        { message: "Warning 1", severity: "warning" },
      ],
    };
    const diags = getDiagnostics(ledger);
    expect(diags).toHaveLength(2);
  });
});

describe("groupDiagnostics", () => {
  it("groups by severity", () => {
    const diags = [
      { message: "E1", severity: "error" as const },
      { message: "W1", severity: "warning" as const },
      { message: "E2", severity: "error" as const },
      { message: "I1", severity: "info" as const },
    ];
    const grouped = groupDiagnostics(diags);
    expect(grouped.errors).toHaveLength(2);
    expect(grouped.warnings).toHaveLength(1);
    expect(grouped.infos).toHaveLength(1);
  });
});

describe("formatDiagnostic", () => {
  it("formats diagnostic with line number", () => {
    const diag = { message: "Bad syntax", severity: "error" as const, line: 10 };
    const formatted = formatDiagnostic(diag);
    expect(formatted).toContain("Line 10");
    expect(formatted).toContain("[ERROR]");
    expect(formatted).toContain("Bad syntax");
  });

  it("formats diagnostic without line number", () => {
    const diag = { message: "Unbalanced", severity: "warning" as const };
    const formatted = formatDiagnostic(diag);
    expect(formatted).not.toContain("Line");
    expect(formatted).toContain("[WARNING]");
  });
});

describe("formatLedgerErrorMessage", () => {
  it("localizes balance assertion errors and account names", () => {
    setLanguage("ja");
    const error: LedgerError = {
      message: "Balance assertion failed for Assets:Cash on 2024-01-15: expected 1000 JPY, got 0 JPY",
      messageKey: "error.balanceAssertion",
      messageArgs: ["Assets:Cash", "2024-01-15", 1000, "JPY", 0],
      severity: "error",
    };
    const message = formatLedgerErrorMessage(error);
    expect(message).toContain("2024-01-15");
    expect(message).toContain("現金");
    expect(message).toContain("期待値 1,000 JPY");
    expect(message).toContain("実残高 0 JPY");
    expect(message).not.toContain("Balance assertion failed");
    setLanguage("en");
  });
});

describe("formatDiagnosticSummary", () => {
  it("returns counts for errors and warnings", () => {
    const diags = [
      { message: "E1", severity: "error" as const },
      { message: "E2", severity: "error" as const },
      { message: "W1", severity: "warning" as const },
    ];
    const summary = formatDiagnosticSummary(diags);
    expect(summary).toContain("2 error(s)");
    expect(summary).toContain("1 warning(s)");
  });

  it("returns no issues when empty", () => {
    expect(formatDiagnosticSummary([])).toBe("No issues found");
  });
});

describe("hasErrors / hasWarnings", () => {
  it("detects errors", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      errors: [{ message: "E", severity: "error" }],
    };
    expect(hasErrors(ledger)).toBe(true);
    expect(hasWarnings(ledger)).toBe(false);
  });

  it("detects warnings", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      errors: [{ message: "W", severity: "warning" }],
    };
    expect(hasErrors(ledger)).toBe(false);
    expect(hasWarnings(ledger)).toBe(true);
  });
});

describe("getDiagnosticCounts", () => {
  it("counts errors and warnings separately", () => {
    const ledger: LedgerData = {
      ...createEmptyLedger("JPY"),
      errors: [
        { message: "E1", severity: "error" },
        { message: "E2", severity: "error" },
        { message: "W1", severity: "warning" },
      ],
    };
    const counts = getDiagnosticCounts(ledger);
    expect(counts.errors).toBe(2);
    expect(counts.warnings).toBe(1);
  });

  it("returns zeros for clean ledger", () => {
    const ledger = createEmptyLedger("JPY");
    const counts = getDiagnosticCounts(ledger);
    expect(counts.errors).toBe(0);
    expect(counts.warnings).toBe(0);
  });
});
