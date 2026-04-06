/**
 * MainView - Main content area for ledger display and reports.
 */

import * as React from "react";
import { t, setLanguage } from "../i18n";
import { useStore, setState } from "../store";
import { ReportType, LedgerData, AccountBalance } from "../types";
import { removeTransaction, refreshErrors } from "../core/ledger";
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
  BalanceSheetReport,
  IncomeStatementReport,
  TrialBalanceReport,
} from "../core/reports";
import { format } from "../core/formatter";
import { parse } from "../core/parser";

interface PluginAPI {
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
}

interface MainViewProps {
  api: PluginAPI;
  fileName?: string;
  fileContent?: string;
  language?: string;
}

function formatNum(n: number, decimals: number): string {
  if (decimals === 0 && Number.isInteger(n)) {
    return n.toLocaleString();
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function MainView(props: MainViewProps) {
  const store = useStore();
  const { ledger, activeReport, settings, filterDateFrom, filterDateTo, filterAccount, filterQuery } = store;

  React.useEffect(() => {
    if (props.language) setLanguage(props.language);
  }, [props.language]);

  React.useEffect(() => {
    if (!props.fileContent) return;
    const nextLedger = refreshErrors(parse(props.fileContent));
    setState({
      ledger: nextLedger,
      fileName: props.fileName || "ledger.beancount",
    });
  }, [props.fileContent, props.fileName]);

  if (!ledger) {
    return (
      <div className="accounting-main">
        <p style={{ color: "#888", padding: 24 }}>
          {t("file.new")}
        </p>
      </div>
    );
  }

  const currency = settings.defaultCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const tabs: { key: ReportType; label: string }[] = [
    { key: "journal", label: t("report.journal") },
    { key: "balance_sheet", label: t("report.balanceSheet") },
    { key: "income_statement", label: t("report.incomeStatement") },
    { key: "trial_balance", label: t("report.trialBalance") },
  ];

  return (
    <div className="accounting-main">
      <div className="accounting-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`accounting-tab ${activeReport === tab.key ? "accounting-tab-active" : ""}`}
            onClick={() => setState({ activeReport: tab.key })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="accounting-filters">
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setState({ filterDateFrom: e.target.value })}
          placeholder="From"
        />
        <span>~</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setState({ filterDateTo: e.target.value })}
          placeholder="To"
        />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setState({ filterQuery: e.target.value })}
          placeholder={t("search")}
          className="accounting-search"
        />
      </div>

      <div className="accounting-report-content">
        {activeReport === "journal" && <JournalView ledger={ledger} api={props.api} />}
        {activeReport === "balance_sheet" && (
          <BalanceSheetView
            report={generateBalanceSheet(ledger, filterDateTo || today, currency)}
            decimals={settings.decimalPlaces}
          />
        )}
        {activeReport === "income_statement" && (
          <IncomeStatementView
            report={generateIncomeStatement(
              ledger,
              filterDateFrom || "1970-01-01",
              filterDateTo || today,
              currency
            )}
            decimals={settings.decimalPlaces}
          />
        )}
        {activeReport === "trial_balance" && (
          <TrialBalanceView
            report={generateTrialBalance(ledger, filterDateTo || today, currency)}
            decimals={settings.decimalPlaces}
          />
        )}
      </div>
    </div>
  );
}

/** Journal (transaction list) view */
function JournalView({ ledger, api }: { ledger: LedgerData; api: PluginAPI }) {
  const store = useStore();
  const { filterDateFrom, filterDateTo, filterQuery, filterAccount, settings } = store;

  let txns = [...ledger.transactions];

  // Apply filters
  if (filterDateFrom) {
    txns = txns.filter((t) => t.date >= filterDateFrom);
  }
  if (filterDateTo) {
    txns = txns.filter((t) => t.date <= filterDateTo);
  }
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    txns = txns.filter(
      (t) =>
        t.narration.toLowerCase().includes(q) ||
        (t.payee && t.payee.toLowerCase().includes(q)) ||
        t.postings.some((p) => p.account.toLowerCase().includes(q))
    );
  }
  if (filterAccount) {
    txns = txns.filter((t) => t.postings.some((p) => p.account.includes(filterAccount)));
  }

  // Sort by date descending
  txns.sort((a, b) => b.date.localeCompare(a.date));

  async function handleDelete(id: string) {
    const newLedger = removeTransaction(ledger, id);
    const text = format(newLedger, settings.decimalPlaces);
    setState({ ledger: newLedger });
    try {
      await api.storage.set("ledgerData", text);
    } catch {
      // Revert on save failure
      setState({ ledger });
    }
  }

  return (
    <div className="accounting-journal">
      {txns.length === 0 && (
        <p style={{ color: "#888", textAlign: "center", padding: 24 }}>
          No transactions
        </p>
      )}
      {txns.map((txn) => (
        <div key={txn.id} className={`accounting-txn-card ${txn.flag === "!" ? "accounting-txn-pending" : ""}`}>
          <div className="accounting-txn-header">
            <span className="accounting-txn-date">{txn.date}</span>
            <span className={`accounting-txn-flag ${txn.flag === "!" ? "accounting-flag-pending" : ""}`}>
              {txn.flag}
            </span>
            {txn.payee && <span className="accounting-txn-payee">{txn.payee}</span>}
            <span className="accounting-txn-narration">{txn.narration}</span>
            <button
              className="accounting-btn accounting-btn-sm accounting-btn-danger"
              onClick={() => handleDelete(txn.id)}
              title={t("delete")}
            >
              ×
            </button>
          </div>
          <div className="accounting-txn-postings">
            {txn.postings.map((p, i) => (
              <div key={i} className="accounting-txn-posting">
                <span className="accounting-posting-account">{p.account}</span>
                <span className={`accounting-posting-amount ${(p.amount || 0) < 0 ? "accounting-negative" : ""}`}>
                  {p.amount !== null ? formatNum(p.amount, settings.decimalPlaces) : ""}{" "}
                  {p.currency}
                </span>
              </div>
            ))}
          </div>
          {txn.tags.length > 0 && (
            <div className="accounting-txn-tags">
              {txn.tags.map((tag) => (
                <span key={tag} className="accounting-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Balance sheet view */
function BalanceSheetView({ report, decimals }: { report: BalanceSheetReport; decimals: number }) {
  return (
    <div className="accounting-report">
      <h3>{t("report.balanceSheet")} ({report.date})</h3>
      <div className="accounting-report-section">
        <h4>{t("account.assets")}</h4>
        <AccountBalanceList balances={report.assets} currency={report.currency} decimals={decimals} />
        <div className="accounting-report-total">
          <strong>{t("report.total")}</strong>
          <strong>{formatNum(report.totalAssets, decimals)} {report.currency}</strong>
        </div>
      </div>

      <div className="accounting-report-section">
        <h4>{t("account.liabilities")}</h4>
        <AccountBalanceList balances={report.liabilities} currency={report.currency} decimals={decimals} negate />
        <div className="accounting-report-total">
          <strong>{t("report.total")}</strong>
          <strong>{formatNum(report.totalLiabilities, decimals)} {report.currency}</strong>
        </div>
      </div>

      <div className="accounting-report-section">
        <h4>{t("account.equity")}</h4>
        <AccountBalanceList balances={report.equity} currency={report.currency} decimals={decimals} negate />
        <div className="accounting-report-total">
          <strong>{t("report.total")}</strong>
          <strong>{formatNum(report.totalEquity, decimals)} {report.currency}</strong>
        </div>
      </div>
    </div>
  );
}

/** Income statement view */
function IncomeStatementView({ report, decimals }: { report: IncomeStatementReport; decimals: number }) {
  return (
    <div className="accounting-report">
      <h3>{t("report.incomeStatement")} ({report.dateFrom} ~ {report.dateTo})</h3>
      <div className="accounting-report-section">
        <h4>{t("account.income")}</h4>
        <AccountBalanceList balances={report.income} currency={report.currency} decimals={decimals} negate />
        <div className="accounting-report-total">
          <strong>{t("report.total")}</strong>
          <strong>{formatNum(report.totalIncome, decimals)} {report.currency}</strong>
        </div>
      </div>

      <div className="accounting-report-section">
        <h4>{t("account.expenses")}</h4>
        <AccountBalanceList balances={report.expenses} currency={report.currency} decimals={decimals} />
        <div className="accounting-report-total">
          <strong>{t("report.total")}</strong>
          <strong>{formatNum(report.totalExpenses, decimals)} {report.currency}</strong>
        </div>
      </div>

      <div className="accounting-report-grand-total">
        <strong>{t("report.netIncome")}</strong>
        <strong className={report.netIncome < 0 ? "accounting-negative" : ""}>
          {formatNum(report.netIncome, decimals)} {report.currency}
        </strong>
      </div>
    </div>
  );
}

/** Trial balance view */
function TrialBalanceView({ report, decimals }: { report: TrialBalanceReport; decimals: number }) {
  return (
    <div className="accounting-report">
      <h3>{t("report.trialBalance")} ({report.date})</h3>
      <table className="accounting-table">
        <thead>
          <tr>
            <th>{t("account")}</th>
            <th style={{ textAlign: "right" }}>Debit</th>
            <th style={{ textAlign: "right" }}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {report.entries.map((entry) => (
            <tr key={entry.account}>
              <td>{entry.account}</td>
              <td style={{ textAlign: "right" }}>
                {entry.debit > 0 ? formatNum(entry.debit, decimals) : ""}
              </td>
              <td style={{ textAlign: "right" }}>
                {entry.credit > 0 ? formatNum(entry.credit, decimals) : ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="accounting-table-total">
            <td><strong>{t("report.total")}</strong></td>
            <td style={{ textAlign: "right" }}>
              <strong>{formatNum(report.totalDebit, decimals)}</strong>
            </td>
            <td style={{ textAlign: "right" }}>
              <strong>{formatNum(report.totalCredit, decimals)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Shared component for account balance lists */
function AccountBalanceList({
  balances,
  currency,
  decimals,
  negate,
}: {
  balances: AccountBalance[];
  currency: string;
  decimals: number;
  negate?: boolean;
}) {
  return (
    <div className="accounting-balance-list">
      {balances.map((ab) => {
        const amount = ab.balances[currency] || 0;
        const display = negate ? -amount : amount;
        return (
          <div key={ab.account} className="accounting-balance-row">
            <span className="accounting-balance-account">{ab.account}</span>
            <span className={`accounting-balance-amount ${display < 0 ? "accounting-negative" : ""}`}>
              {formatNum(display, decimals)} {currency}
            </span>
          </div>
        );
      })}
    </div>
  );
}
