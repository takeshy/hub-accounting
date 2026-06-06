/**
 * Transaction classification rules.
 * Auto-assigns counterpart accounts based on payee/narration regex patterns.
 *
 * Based on go-beancount's pkg/importer/hook/std/classify:
 * Rules are matched in order; the first match wins.
 */

import { ParsedRow } from "./csv-import";

/** A single classification rule */
export interface ClassifyRule {
  /** Regex pattern to match against row payee (falls back to description) */
  payeeRegex?: string;
  /** Regex pattern to match against row narration (falls back to description) */
  narrationRegex?: string;
  /** Target account to assign when matched */
  account: string;
}

/** A named rule set for persistence */
export interface ClassifyRuleSet {
  /** Rule set name */
  name: string;
  /** Rules in priority order */
  rules: ClassifyRule[];
}

/** Compile a rule's regex strings into RegExp objects */
function compileRule(rule: ClassifyRule): { payeeRe?: RegExp; narrationRe?: RegExp; account: string } {
  return {
    payeeRe: rule.payeeRegex ? new RegExp(rule.payeeRegex, "i") : undefined,
    narrationRe: rule.narrationRegex ? new RegExp(rule.narrationRegex, "i") : undefined,
    account: rule.account,
  };
}

/**
 * Match a single row against compiled rules.
 * Returns the matched account or null if no rule matches.
 */
function matchRule(
  row: ParsedRow,
  rules: ReturnType<typeof compileRule>[]
): string | null {
  const payee = row.payee ?? row.description;
  const narration = row.narration ?? row.description;
  for (const rule of rules) {
    if (rule.payeeRe && !rule.payeeRe.test(payee)) continue;
    if (rule.narrationRe && !rule.narrationRe.test(narration)) continue;
    return rule.account;
  }
  return null;
}

/**
 * Apply classification rules to parsed CSV rows.
 * Updates the counterpartAccount field of each matching row.
 * Returns a new array with updated rows (does not mutate originals).
 */
export function applyClassifyRules(
  rows: ParsedRow[],
  rules: ClassifyRule[]
): ParsedRow[] {
  if (rules.length === 0) return rows;

  const compiled = rules.map(compileRule);

  return rows.map((row) => {
    const account = matchRule(row, compiled);
    if (account) {
      return { ...row, counterpartAccount: account };
    }
    return row;
  });
}

/**
 * Validate a regex pattern string.
 * Returns an error message if invalid, null if valid.
 */
export function validateRegex(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/**
 * Validate a complete rule set.
 * Returns an array of error messages (empty if all valid).
 */
export function validateRuleSet(rules: ClassifyRule[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule.payeeRegex && !rule.narrationRegex) {
      errors.push(`Rule ${i + 1}: at least one of payeeRegex or narrationRegex is required`);
    }
    if (rule.payeeRegex) {
      const err = validateRegex(rule.payeeRegex);
      if (err) errors.push(`Rule ${i + 1} payeeRegex: ${err}`);
    }
    if (rule.narrationRegex) {
      const err = validateRegex(rule.narrationRegex);
      if (err) errors.push(`Rule ${i + 1} narrationRegex: ${err}`);
    }
    if (!rule.account) {
      errors.push(`Rule ${i + 1}: account is required`);
    }
  }
  return errors;
}
