/**
 * Diagnostics: format and group validation errors for UI display.
 * Based on beancount-lsp's diagnostics publishing logic.
 */

import { LedgerData, LedgerError } from "../types";
import { t, tAccount, tFormat } from "../i18n";

/** Diagnostic severity */
export type DiagnosticSeverity = "error" | "warning" | "info";

/** A diagnostic message for UI display */
export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  line?: number;
  source?: string;
}

/** Diagnostics grouped by severity */
export interface GroupedDiagnostics {
  errors: Diagnostic[];
  warnings: Diagnostic[];
  infos: Diagnostic[];
}

/** Convert LedgerError to Diagnostic */
export function toDiagnostic(error: LedgerError): Diagnostic {
  return {
    message: formatLedgerErrorMessage(error),
    severity: error.severity === "error" ? "error" : "warning",
    line: error.line,
    source: "beancount",
  };
}

export function formatLedgerErrorMessage(error: LedgerError): string {
  if (error.messageKey === "error.balanceAssertion" && error.messageArgs) {
    const [account, date, expected, currency, actual] = error.messageArgs;
    return tFormat(
      "error.balanceAssertion",
      tAccount(String(account)),
      String(date),
      Number(expected).toLocaleString(),
      String(currency),
      Number(actual).toLocaleString()
    );
  }
  if (error.messageKey) {
    return tFormat(error.messageKey, ...(error.messageArgs ?? []));
  }
  return error.message;
}

/** Get all diagnostics from a ledger (parse errors + validation errors) */
export function getDiagnostics(ledger: LedgerData): Diagnostic[] {
  return ledger.errors.map(toDiagnostic);
}

/** Group diagnostics by severity */
export function groupDiagnostics(diagnostics: Diagnostic[]): GroupedDiagnostics {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const infos: Diagnostic[] = [];

  for (const d of diagnostics) {
    switch (d.severity) {
      case "error":
        errors.push(d);
        break;
      case "warning":
        warnings.push(d);
        break;
      case "info":
        infos.push(d);
        break;
    }
  }

  return { errors, warnings, infos };
}

/** Format a diagnostic for display */
export function formatDiagnostic(d: Diagnostic): string {
  const parts: string[] = [];
  if (d.line !== undefined) {
    parts.push(tFormat("diagnostics.line", d.line));
  }
  parts.push(`[${t(`diagnostics.severity.${d.severity}`)}]`);
  parts.push(d.message);
  return parts.join(" ");
}

/** Format all diagnostics as a summary string */
export function formatDiagnosticSummary(diagnostics: Diagnostic[]): string {
  const grouped = groupDiagnostics(diagnostics);
  const parts: string[] = [];

  if (grouped.errors.length > 0) {
    parts.push(`${grouped.errors.length} error(s)`);
  }
  if (grouped.warnings.length > 0) {
    parts.push(`${grouped.warnings.length} warning(s)`);
  }
  if (parts.length === 0) {
    return "No issues found";
  }
  return parts.join(", ");
}

/** Check if ledger has any errors (not warnings) */
export function hasErrors(ledger: LedgerData): boolean {
  return ledger.errors.some((e) => e.severity === "error");
}

/** Check if ledger has any warnings */
export function hasWarnings(ledger: LedgerData): boolean {
  return ledger.errors.some((e) => e.severity === "warning");
}

/** Get a count summary for badge display */
export function getDiagnosticCounts(ledger: LedgerData): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const e of ledger.errors) {
    if (e.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings };
}
