/**
 * Google Sheets export — generates spreadsheet data for all reports.
 */

import { LedgerData, TaxCategory, Posting } from "../types";
import { autoBalance, getAccountType } from "./ledger";
import { generateBalanceSheet, generateIncomeStatement, generateTrialBalance } from "./reports";
import { generateConsumptionTaxReport } from "./tax";

type CellValue = string | number;
type Row = CellValue[];

/** Map TaxCategory + account type to Japanese tax label */
function taxLabel(category: TaxCategory | undefined, accountType: string | null): string {
  if (!category) return "対象外";
  switch (category) {
    case "taxable_10":
      return accountType === "Income" ? "課税売上10%" : "課対仕入10%";
    case "taxable_8":
      return accountType === "Income" ? "課税売上8%(軽)" : "課対仕入8%(軽)";
    case "exempt":
      return accountType === "Income" ? "非課売上" : "非課仕入";
    case "non_taxable":
      return "対象外";
    case "tax_free":
      return "不課税";
    default:
      return "対象外";
  }
}

/** Translate account name using i18n. Falls back to last component. */
function translateAccount(accountName: string, i18nFn: (key: string) => string): string {
  const translated = i18nFn(`account.${accountName}`);
  if (translated === `account.${accountName}`) {
    const parts = accountName.split(":");
    return parts[parts.length - 1];
  }
  return translated;
}

/** Split account into main and sub-account */
function splitAccount(accountName: string, i18nFn: (key: string) => string): [string, string] {
  const parts = accountName.split(":");
  if (parts.length <= 2) {
    return [translateAccount(accountName, i18nFn), ""];
  }
  const mainName = `${parts[0]}:${parts[1]}`;
  const subName = parts.slice(2).join(":");
  return [translateAccount(mainName, i18nFn), subName];
}

/** Generate journal sheet data */
function journalSheet(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string,
  i18nFn: (key: string) => string
): Row[] {
  const header: Row = [
    "取引日", "借方勘定科目", "借方補助科目", "借方税区分", "借方金額",
    "貸方勘定科目", "貸方補助科目", "貸方税区分", "貸方金額", "摘要",
  ];
  const rows: Row[] = [header];

  const txns = ledger.transactions.filter(
    (t) => t.date >= dateFrom && t.date <= dateTo
  );

  for (const txn of txns) {
    const balanced = autoBalance(txn);
    const postings = balanced.postings.filter(
      (p) => p.amount !== null && p.currency === currency
    );

    const debits: Posting[] = [];
    const credits: Posting[] = [];
    for (const p of postings) {
      if (p.amount! > 0) debits.push(p);
      else if (p.amount! < 0) credits.push(p);
    }

    const narration = txn.payee ? `${txn.payee} ${txn.narration}` : txn.narration;
    const maxLen = Math.max(debits.length, credits.length);

    for (let i = 0; i < maxLen; i++) {
      const d = debits[i];
      const c = credits[i];
      const dAccType = d ? getAccountType(d.account) : null;
      const cAccType = c ? getAccountType(c.account) : null;
      const [dMain, dSub] = d ? splitAccount(d.account, i18nFn) : ["", ""];
      const [cMain, cSub] = c ? splitAccount(c.account, i18nFn) : ["", ""];

      rows.push([
        txn.date,
        dMain,
        dSub,
        d ? taxLabel(d.taxCategory, dAccType) : "",
        d ? Math.abs(d.amount!) : "",
        cMain,
        cSub,
        c ? taxLabel(c.taxCategory, cAccType) : "",
        c ? Math.abs(c.amount!) : "",
        i === 0 ? narration : "",
      ]);
    }
  }

  return rows;
}

/** Generate balance sheet data */
function balanceSheetSheet(
  ledger: LedgerData,
  date: string,
  currency: string,
  i18nFn: (key: string) => string
): Row[] {
  const report = generateBalanceSheet(ledger, date, currency);
  const rows: Row[] = [
    [i18nFn("report.balanceSheet"), report.date],
    [],
    [i18nFn("account.assets"), ""],
  ];

  for (const ab of report.assets) {
    const amount = ab.balances[currency] || 0;
    if (amount !== 0) rows.push(["", translateAccount(ab.account, i18nFn), amount]);
  }
  rows.push(["", i18nFn("report.total"), report.totalAssets]);
  rows.push([]);

  rows.push([i18nFn("account.liabilities"), ""]);
  for (const ab of report.liabilities) {
    const amount = -(ab.balances[currency] || 0);
    if (amount !== 0) rows.push(["", translateAccount(ab.account, i18nFn), amount]);
  }
  rows.push(["", i18nFn("report.total"), report.totalLiabilities]);
  rows.push([]);

  rows.push([i18nFn("account.equity"), ""]);
  for (const ab of report.equity) {
    const amount = -(ab.balances[currency] || 0);
    if (amount !== 0) rows.push(["", translateAccount(ab.account, i18nFn), amount]);
  }
  rows.push(["", i18nFn("report.total"), report.totalEquity]);

  return rows;
}

/** Generate income statement data */
function incomeStatementSheet(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string,
  i18nFn: (key: string) => string
): Row[] {
  const report = generateIncomeStatement(ledger, dateFrom, dateTo, currency);
  const rows: Row[] = [
    [i18nFn("report.incomeStatement"), `${report.dateFrom} ~ ${report.dateTo}`],
    [],
    [i18nFn("account.income"), ""],
  ];

  for (const ab of report.income) {
    const amount = -(ab.balances[currency] || 0);
    if (amount !== 0) rows.push(["", translateAccount(ab.account, i18nFn), amount]);
  }
  rows.push(["", i18nFn("report.total"), report.totalIncome]);
  rows.push([]);

  rows.push([i18nFn("account.expenses"), ""]);
  for (const ab of report.expenses) {
    const amount = ab.balances[currency] || 0;
    if (amount !== 0) rows.push(["", translateAccount(ab.account, i18nFn), amount]);
  }
  rows.push(["", i18nFn("report.total"), report.totalExpenses]);
  rows.push([]);

  rows.push([i18nFn("report.netIncome"), "", report.netIncome]);

  return rows;
}

/** Generate trial balance data */
function trialBalanceSheet(
  ledger: LedgerData,
  date: string,
  currency: string,
  i18nFn: (key: string) => string
): Row[] {
  const report = generateTrialBalance(ledger, date, currency);
  const rows: Row[] = [
    [i18nFn("report.trialBalance"), report.date],
    [],
    [i18nFn("account"), i18nFn("table.debit"), i18nFn("table.credit")],
  ];

  for (const entry of report.entries) {
    rows.push([
      translateAccount(entry.account, i18nFn),
      entry.debit > 0 ? entry.debit : "",
      entry.credit > 0 ? entry.credit : "",
    ]);
  }

  rows.push([i18nFn("report.total"), report.totalDebit, report.totalCredit]);

  return rows;
}

/** Generate consumption tax report data */
function consumptionTaxSheet(
  ledger: LedgerData,
  dateFrom: string,
  dateTo: string,
  currency: string,
  i18nFn: (key: string) => string
): Row[] {
  const report = generateConsumptionTaxReport(ledger, dateFrom, dateTo, currency);
  const rows: Row[] = [
    [i18nFn("report.consumptionTax"), `${report.dateFrom} ~ ${report.dateTo}`],
    [],
    [i18nFn("tax.sales"), "", "", ""],
    [i18nFn("tax.category"), i18nFn("amount"), i18nFn("tax.taxAmount"), i18nFn("tax.netAmount")],
    [i18nFn("tax.rate10"), report.sales.taxable10.totalAmount, report.sales.taxable10.taxAmount, report.sales.taxable10.netAmount],
    [i18nFn("tax.rate8"), report.sales.taxable8.totalAmount, report.sales.taxable8.taxAmount, report.sales.taxable8.netAmount],
    [i18nFn("tax.exempt"), report.sales.exempt.totalAmount, "-", report.sales.exempt.netAmount],
    [i18nFn("tax.totalTax"), "", report.sales.totalTax, ""],
    [],
    [i18nFn("tax.purchases"), "", "", ""],
    [i18nFn("tax.category"), i18nFn("amount"), i18nFn("tax.taxAmount"), i18nFn("tax.netAmount")],
    [i18nFn("tax.rate10"), report.purchases.taxable10.totalAmount, report.purchases.taxable10.taxAmount, report.purchases.taxable10.netAmount],
    [i18nFn("tax.rate8"), report.purchases.taxable8.totalAmount, report.purchases.taxable8.taxAmount, report.purchases.taxable8.netAmount],
    [i18nFn("tax.exempt"), report.purchases.exempt.totalAmount, "-", report.purchases.exempt.netAmount],
    [i18nFn("tax.totalTax"), "", report.purchases.totalTax, ""],
    [],
    [i18nFn("tax.netPayable"), "", report.netTaxPayable, ""],
  ];

  return rows;
}

/** Escape sheet name for use in range notation */
function escapeSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export interface SheetsAPI {
  createSpreadsheet(options: {
    title: string;
    sheets?: string[];
  }): Promise<{ spreadsheetId: string; url: string }>;
  batchWriteSheet(options: {
    spreadsheetId: string;
    data: Array<{ range: string; values: (string | number)[][] }>;
  }): Promise<void>;
}

/**
 * Export all reports to a Google Spreadsheet.
 * Returns the spreadsheet URL.
 */
export async function exportToGoogleSheets(
  sheetsApi: SheetsAPI,
  ledger: LedgerData,
  fiscalYear: number,
  dateFrom: string,
  dateTo: string,
  currency: string,
  i18nFn: (key: string) => string
): Promise<string> {
  const sheetNames = [
    i18nFn("report.journal"),
    i18nFn("report.balanceSheet"),
    i18nFn("report.incomeStatement"),
    i18nFn("report.trialBalance"),
    i18nFn("report.consumptionTax"),
  ];

  const title = `${i18nFn("plugin.name")} ${fiscalYear}`;
  const { spreadsheetId, url } = await sheetsApi.createSpreadsheet({
    title,
    sheets: sheetNames,
  });

  const data = [
    { range: `${escapeSheetName(sheetNames[0])}!A1`, values: journalSheet(ledger, dateFrom, dateTo, currency, i18nFn) },
    { range: `${escapeSheetName(sheetNames[1])}!A1`, values: balanceSheetSheet(ledger, dateTo, currency, i18nFn) },
    { range: `${escapeSheetName(sheetNames[2])}!A1`, values: incomeStatementSheet(ledger, dateFrom, dateTo, currency, i18nFn) },
    { range: `${escapeSheetName(sheetNames[3])}!A1`, values: trialBalanceSheet(ledger, dateTo, currency, i18nFn) },
    { range: `${escapeSheetName(sheetNames[4])}!A1`, values: consumptionTaxSheet(ledger, dateFrom, dateTo, currency, i18nFn) },
  ];

  await sheetsApi.batchWriteSheet({ spreadsheetId, data });

  return url;
}
