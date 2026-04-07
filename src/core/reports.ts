/**
 * Report generation: balance sheet, income statement, trial balance.
 */

import { LedgerData, AccountBalance, AccountType } from "../types";
import {
  autoBalance,
  calculateBalances,
  getAccountType,
  getBalancesByType,
  sumBalances,
} from "./ledger";

/** Monthly income vs expenses summary */
export interface MonthlySummary {
  month: string;
  income: number;
  expenses: number;
}

/** Net worth at a point in time */
export interface NetWorthPoint {
  month: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

/** Expense category breakdown */
export interface ExpenseCategory {
  account: string;
  amount: number;
  percentage: number;
}

/** Dashboard aggregate data */
export interface DashboardData {
  monthlySummary: MonthlySummary[];
  netWorth: NetWorthPoint[];
  expenseBreakdown: ExpenseCategory[];
  totalIncome: number;
  totalExpenses: number;
  currentNetWorth: number;
}

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

/** General ledger entry (one line per posting in the selected account) */
export interface GeneralLedgerEntry {
  date: string;
  payee?: string;
  narration: string;
  counterpart: string;
  debit: number;
  credit: number;
  balance: number;
  txnId: string;
}

/** General ledger report for a single account */
export interface GeneralLedgerReport {
  account: string;
  dateFrom: string;
  dateTo: string;
  currency: string;
  openingBalance: number;
  entries: GeneralLedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

/** Subsidiary ledger entry (one line per transaction with the selected payee) */
export interface SubsidiaryLedgerEntry {
  date: string;
  narration: string;
  account: string;
  debit: number;
  credit: number;
  txnId: string;
}

/** Subsidiary ledger report for a single payee */
export interface SubsidiaryLedgerReport {
  payee: string;
  dateFrom: string;
  dateTo: string;
  currency: string;
  entries: SubsidiaryLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
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

/** Generate a general ledger (勘定元帳) for a specific account */
export function generateGeneralLedger(
  ledger: LedgerData,
  account: string,
  dateFrom: string,
  dateTo: string,
  currency: string
): GeneralLedgerReport {
  // Calculate opening balance (all transactions before dateFrom)
  const preTxns = ledger.transactions.filter(
    (t) => t.date < dateFrom && t.postings.some((p) => p.account === account)
  );
  let openingBalance = 0;
  for (const txn of preTxns) {
    const balanced = autoBalance(txn);
    for (const p of balanced.postings) {
      if (p.account === account && p.amount !== null && p.currency === currency) {
        openingBalance += p.amount;
      }
    }
  }

  // Get transactions in the date range that involve this account
  const txns = ledger.transactions
    .filter(
      (t) =>
        t.date >= dateFrom &&
        t.date <= dateTo &&
        t.postings.some((p) => p.account === account)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const entries: GeneralLedgerEntry[] = [];
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const txn of txns) {
    const balanced = autoBalance(txn);
    // Sum all postings for this account in this transaction
    let amount = 0;
    for (const p of balanced.postings) {
      if (p.account === account && p.amount !== null && p.currency === currency) {
        amount += p.amount;
      }
    }
    if (amount === 0) continue;

    // Counterpart accounts (all other accounts in this transaction)
    const counterparts = balanced.postings
      .filter((p) => p.account !== account)
      .map((p) => p.account);
    const counterpart = [...new Set(counterparts)].join(", ");

    const debit = amount > 0 ? amount : 0;
    const credit = amount < 0 ? -amount : 0;
    runningBalance += amount;
    totalDebit += debit;
    totalCredit += credit;

    entries.push({
      date: txn.date,
      payee: txn.payee,
      narration: txn.narration,
      counterpart,
      debit,
      credit,
      balance: runningBalance,
      txnId: txn.id,
    });
  }

  return {
    account,
    dateFrom,
    dateTo,
    currency,
    openingBalance,
    entries,
    closingBalance: runningBalance,
    totalDebit,
    totalCredit,
  };
}

/** Generate a subsidiary ledger (補助元帳) for a specific payee */
export function generateSubsidiaryLedger(
  ledger: LedgerData,
  payee: string,
  dateFrom: string,
  dateTo: string,
  currency: string
): SubsidiaryLedgerReport {
  // Get transactions for this payee in the date range
  const txns = ledger.transactions
    .filter(
      (t) =>
        t.date >= dateFrom &&
        t.date <= dateTo &&
        t.payee === payee
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const entries: SubsidiaryLedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const txn of txns) {
    const balanced = autoBalance(txn);
    for (const p of balanced.postings) {
      if (p.amount === null || p.currency !== currency) continue;
      const debit = p.amount > 0 ? p.amount : 0;
      const credit = p.amount < 0 ? -p.amount : 0;
      totalDebit += debit;
      totalCredit += credit;

      entries.push({
        date: txn.date,
        narration: txn.narration,
        account: p.account,
        debit,
        credit,
        txnId: txn.id,
      });
    }
  }

  return {
    payee,
    dateFrom,
    dateTo,
    currency,
    entries,
    totalDebit,
    totalCredit,
  };
}

/** Generate month strings between two dates (inclusive) */
function monthRange(dateFrom: string, dateTo: string): string[] {
  const months: string[] = [];
  const [startY, startM] = dateFrom.slice(0, 7).split("-").map(Number);
  const [endY, endM] = dateTo.slice(0, 7).split("-").map(Number);
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/** Last day of a given month string "YYYY-MM" */
function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Generate dashboard data */
export function generateDashboardData(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string
): DashboardData {
  // Clamp dateFrom to earliest transaction to avoid generating hundreds of empty months
  if (ledger.transactions.length > 0) {
    const earliest = ledger.transactions.reduce(
      (min, t) => (t.date < min ? t.date : min),
      ledger.transactions[0].date
    );
    if (dateFrom < earliest) dateFrom = earliest;
  }
  const months = monthRange(dateFrom, dateTo);

  // --- Monthly income vs expenses ---
  const monthlyIncome = new Map<string, number>();
  const monthlyExpenses = new Map<string, number>();
  for (const m of months) {
    monthlyIncome.set(m, 0);
    monthlyExpenses.set(m, 0);
  }

  for (const txn of ledger.transactions) {
    if (txn.date < dateFrom || txn.date > dateTo) continue;
    const m = txn.date.slice(0, 7);
    if (!monthlyIncome.has(m)) continue;
    const balanced = autoBalance(txn);
    for (const p of balanced.postings) {
      if (p.amount === null || p.currency !== currency) continue;
      const type = getAccountType(p.account);
      if (type === "Income") {
        monthlyIncome.set(m, (monthlyIncome.get(m) || 0) + (-p.amount)); // Income is negative in beancount
      } else if (type === "Expenses") {
        monthlyExpenses.set(m, (monthlyExpenses.get(m) || 0) + p.amount);
      }
    }
  }

  const monthlySummary: MonthlySummary[] = months.map((m) => ({
    month: m,
    income: monthlyIncome.get(m) || 0,
    expenses: monthlyExpenses.get(m) || 0,
  }));

  // --- Net worth trend (cumulative at end of each month) ---
  const netWorth: NetWorthPoint[] = [];
  for (const m of months) {
    const endDate = lastDayOfMonth(m);
    const balances = calculateBalances(ledger, endDate);
    const byType = getBalancesByType(balances);
    const assets = sumBalances(byType.Assets, currency) || 0;
    const liabilities = -(sumBalances(byType.Liabilities, currency) || 0);
    netWorth.push({
      month: m,
      assets,
      liabilities,
      netWorth: assets - liabilities,
    });
  }

  // --- Expense breakdown ---
  const expenseMap = new Map<string, number>();
  for (const txn of ledger.transactions) {
    if (txn.date < dateFrom || txn.date > dateTo) continue;
    const balanced = autoBalance(txn);
    for (const p of balanced.postings) {
      if (p.amount === null || p.currency !== currency) continue;
      if (getAccountType(p.account) !== "Expenses") continue;
      expenseMap.set(p.account, (expenseMap.get(p.account) || 0) + p.amount);
    }
  }

  const positiveExpenses = [...expenseMap.entries()].filter(([, v]) => v > 0);
  const totalExpFromMap = positiveExpenses.reduce((s, [, v]) => s + v, 0);
  const expenseBreakdown: ExpenseCategory[] = positiveExpenses
    .sort((a, b) => b[1] - a[1])
    .map(([account, amount]) => ({
      account,
      amount,
      percentage: totalExpFromMap > 0 ? (amount / totalExpFromMap) * 100 : 0,
    }));

  // --- Totals ---
  const totalIncome = monthlySummary.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthlySummary.reduce((s, m) => s + m.expenses, 0);
  const currentNetWorth = netWorth.length > 0 ? netWorth[netWorth.length - 1].netWorth : 0;

  return {
    monthlySummary,
    netWorth,
    expenseBreakdown,
    totalIncome,
    totalExpenses,
    currentNetWorth,
  };
}
