/**
 * Report generation: balance sheet, income statement, trial balance.
 */

import { LedgerData, AccountBalance, AccountType } from "../types";
import {
  calculateBalances,
  getAccountType,
  getBalancesByType,
  sumBalances,
} from "./ledger";

/** Balance sheet report data */
export interface BalanceSheetReport {
  date: string;
  currency: string;
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** Assets - (Liabilities + Equity), should be 0 */
  difference: number;
}

/** Income statement report data */
export interface IncomeStatementReport {
  dateFrom: string;
  dateTo: string;
  currency: string;
  income: AccountBalance[];
  expenses: AccountBalance[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

/** Trial balance entry */
export interface TrialBalanceEntry {
  account: string;
  type: AccountType;
  debit: number;
  credit: number;
}

/** Trial balance report data */
export interface TrialBalanceReport {
  date: string;
  currency: string;
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
}

/** Generate a balance sheet */
export function generateBalanceSheet(
  ledger: LedgerData,
  date: string,
  currency: string
): BalanceSheetReport {
  const balances = calculateBalances(ledger, date);
  const byType = getBalancesByType(balances);

  // Calculate net income (Income - Expenses) to include in Equity
  // Use (x || 0) to normalize -0 to 0
  const totalIncome = -sumBalances(byType.Income, currency) || 0; // Income is negative in beancount
  const totalExpenses = sumBalances(byType.Expenses, currency) || 0;
  const netIncome = totalIncome - totalExpenses;

  const totalAssets = sumBalances(byType.Assets, currency) || 0;
  const totalLiabilities = -sumBalances(byType.Liabilities, currency) || 0; // Liabilities are negative
  const totalEquity = (-sumBalances(byType.Equity, currency) || 0) + netIncome;

  return {
    date,
    currency,
    assets: byType.Assets,
    liabilities: byType.Liabilities,
    equity: byType.Equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    difference: totalAssets - totalLiabilities - totalEquity,
  };
}

/** Generate an income statement */
export function generateIncomeStatement(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string
): IncomeStatementReport {
  // Filter transactions by date range
  const filteredLedger: LedgerData = {
    ...ledger,
    transactions: ledger.transactions.filter(
      (t) => t.date >= dateFrom && t.date <= dateTo
    ),
  };

  const balances = calculateBalances(filteredLedger);
  const byType = getBalancesByType(balances);

  const totalIncome = -sumBalances(byType.Income, currency) || 0; // Income postings are negative
  const totalExpenses = sumBalances(byType.Expenses, currency) || 0;

  return {
    dateFrom,
    dateTo,
    currency,
    income: byType.Income,
    expenses: byType.Expenses,
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
  };
}

/** Generate a trial balance */
export function generateTrialBalance(
  ledger: LedgerData,
  date: string,
  currency: string
): TrialBalanceReport {
  const balances = calculateBalances(ledger, date);
  const entries: TrialBalanceEntry[] = [];

  let totalDebit = 0;
  let totalCredit = 0;

  for (const ab of balances) {
    const amount = ab.balances[currency] || 0;
    if (amount === 0) continue;

    const type = getAccountType(ab.account);
    if (!type) continue;
    const debit = amount > 0 ? amount : 0;
    const credit = amount < 0 ? -amount : 0;

    entries.push({ account: ab.account, type, debit, credit });
    totalDebit += debit;
    totalCredit += credit;
  }

  return {
    date,
    currency,
    entries,
    totalDebit,
    totalCredit,
  };
}
