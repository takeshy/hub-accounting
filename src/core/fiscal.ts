/**
 * Fiscal year calculation and year-end carry-forward.
 */

import { LedgerData, Account, Directive } from "../types";
import {
  calculateBalances,
  getBalancesByType,
  sumBalances,
  createEmptyLedger,
  refreshErrors,
} from "./ledger";

/** Get the fiscal year for a given date */
export function getFiscalYear(date: string, startMonth: number): number {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  // If before the start month, it belongs to the previous fiscal year
  return month < startMonth ? year - 1 : year;
}

/** Get the date range for a fiscal year */
export function getFiscalYearRange(
  year: number,
  startMonth: number
): { start: string; end: string } {
  const sm = String(startMonth).padStart(2, "0");
  const start = `${year}-${sm}-01`;

  // End is the last day of the month before startMonth in the next year
  // (or same year if startMonth is 1)
  let endYear = startMonth === 1 ? year : year + 1;
  let endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const em = String(endMonth).padStart(2, "0");
  const end = `${endYear}-${em}-${String(lastDay).padStart(2, "0")}`;

  return { start, end };
}

/** Get the file name for a fiscal year */
export function getFiscalYearFileName(year: number, directory: string): string {
  return `${directory}/${year}.beancount`;
}

/**
 * Carry forward balances from old ledger to create a new fiscal year ledger.
 *
 * - Assets/Liabilities/Equity balances are carried forward as opening entries
 * - Income/Expenses are closed (net income transferred to Equity:OpeningCapital)
 */
export function carryForward(
  oldLedger: LedgerData,
  newYear: number,
  startMonth: number,
  currency: string
): LedgerData {
  const { start } = getFiscalYearRange(newYear, startMonth);
  const balances = calculateBalances(oldLedger);
  const byType = getBalancesByType(balances);

  // Calculate net income (Income - Expenses) to add to Equity
  const totalIncome = -sumBalances(byType.Income, currency) || 0;
  const totalExpenses = sumBalances(byType.Expenses, currency) || 0;
  const netIncome = totalIncome - totalExpenses;

  // Reuse accounts from old ledger
  const accounts: Account[] = oldLedger.accounts.map((a) => ({
    ...a,
    openDate: start,
    closeDate: undefined,
  }));

  // Ensure Equity:OpeningCapital exists
  const equityAccount = "Equity:OpeningCapital";
  if (!accounts.find((a) => a.name === equityAccount)) {
    accounts.push({
      name: equityAccount,
      type: "Equity",
      openDate: start,
      currencies: [currency],
    });
  }

  const directives: Directive[] = [
    { type: "option", key: "operating_currency", value: currency },
    ...accounts.map(
      (a): Directive => ({
        type: "open",
        date: a.openDate,
        account: a.name,
        currencies: a.currencies,
      })
    ),
  ];

  // Build opening balance transactions
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const transactions: LedgerData["transactions"] = [];

  // Carry forward each Asset/Liability/Equity account balance
  for (const type of ["Assets", "Liabilities", "Equity"] as const) {
    for (const ab of byType[type]) {
      const amount = ab.balances[currency] || 0;
      if (amount === 0) continue;

      const txn = {
        id: uid(),
        date: start,
        flag: "*" as const,
        narration: `繰越 ${ab.account}`,
        postings: [
          { account: ab.account, amount, currency },
          { account: equityAccount, amount: -amount, currency },
        ],
        tags: ["carry-forward"],
        links: [],
      };
      transactions.push(txn);
      directives.push({ type: "transaction", data: txn });
    }
  }

  // Transfer net income (Income - Expenses) to Equity:OpeningCapital
  if (netIncome !== 0) {
    const txn = {
      id: uid(),
      date: start,
      flag: "*" as const,
      narration: "当期純利益の振替",
      postings: [
        { account: equityAccount, amount: -netIncome, currency },
        { account: "Equity:RetainedEarnings", amount: netIncome, currency },
      ],
      tags: ["carry-forward"],
      links: [],
    };
    // Ensure RetainedEarnings account exists
    if (!accounts.find((a) => a.name === "Equity:RetainedEarnings")) {
      accounts.push({
        name: "Equity:RetainedEarnings",
        type: "Equity",
        openDate: start,
        currencies: [currency],
      });
      directives.push({
        type: "open",
        date: start,
        account: "Equity:RetainedEarnings",
        currencies: [currency],
      });
    }
    transactions.push(txn);
    directives.push({ type: "transaction", data: txn });
  }

  return refreshErrors({
    directives,
    options: { operating_currency: currency },
    accounts,
    transactions,
    errors: [],
  });
}
