/**
 * MainView - Main content area for ledger display and reports.
 */

import * as React from "react";
import { t, tAccount, setLanguage } from "../i18n";
import { useStore, setState, saveLedger as storeSaveLedger } from "../store";
import { ReportType, LedgerData, AccountBalance } from "../types";
import { removeTransaction, refreshErrors } from "../core/ledger";

import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
  generateGeneralLedger,
  generateSubsidiaryLedger,
  BalanceSheetReport,
  IncomeStatementReport,
  TrialBalanceReport,
} from "../core/reports";

import { parse } from "../core/parser";
import { generateConsumptionTaxReport, ConsumptionTaxReport } from "../core/tax";

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
    { key: "consumption_tax", label: t("report.consumptionTax") },
    { key: "general_ledger", label: t("report.generalLedger") },
    { key: "subsidiary_ledger", label: t("report.subsidiaryLedger") },
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
          placeholder={t("filter.from")}
        />
        <span>~</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setState({ filterDateTo: e.target.value })}
          placeholder={t("filter.to")}
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
        {activeReport === "consumption_tax" && (
          <ConsumptionTaxView
            report={generateConsumptionTaxReport(
              ledger,
              filterDateFrom || "1970-01-01",
              filterDateTo || today,
              currency
            )}
            decimals={settings.decimalPlaces}
          />
        )}
        {activeReport === "general_ledger" && (
          <GeneralLedgerView
            ledger={ledger}
            dateFrom={filterDateFrom || "1970-01-01"}
            dateTo={filterDateTo || today}
            currency={currency}
            decimals={settings.decimalPlaces}
          />
        )}
        {activeReport === "subsidiary_ledger" && (
          <SubsidiaryLedgerView
            ledger={ledger}
            dateFrom={filterDateFrom || "1970-01-01"}
            dateTo={filterDateTo || today}
            currency={currency}
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
    setState({ ledger: newLedger });
    try {
      await storeSaveLedger(newLedger);
    } catch {
      setState({ ledger });
    }
  }

  return (
    <div className="accounting-journal">
      {txns.length === 0 && (
        <p style={{ color: "#888", textAlign: "center", padding: 24 }}>
          {t("txn.empty")}
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
              className="accounting-btn accounting-btn-sm"
              onClick={() => setState({ editingTxnId: txn.id })}
              title={t("edit")}
            >
              ✎
            </button>
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
                <span className="accounting-posting-account">{tAccount(p.account)}</span>
                <span className={`accounting-posting-amount ${(p.amount || 0) < 0 ? "accounting-negative" : ""}`}>
                  {p.amount !== null ? formatNum(p.amount, settings.decimalPlaces) : ""}{" "}
                  {p.currency}
                  {p.taxCategory && (
                    <span className="accounting-tax-badge">{t(`tax.${p.taxCategory}`)}</span>
                  )}
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
            <th style={{ textAlign: "right" }}>{t("table.debit")}</th>
            <th style={{ textAlign: "right" }}>{t("table.credit")}</th>
          </tr>
        </thead>
        <tbody>
          {report.entries.map((entry) => (
            <tr key={entry.account}>
              <td>{tAccount(entry.account)}</td>
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
            <span className="accounting-balance-account">{tAccount(ab.account)}</span>
            <span className={`accounting-balance-amount ${display < 0 ? "accounting-negative" : ""}`}>
              {formatNum(display, decimals)} {currency}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Consumption tax report view */
function ConsumptionTaxView({ report, decimals }: { report: ConsumptionTaxReport; decimals: number }) {
  function TaxSection({ title, data }: { title: string; data: ConsumptionTaxReport["sales"] }) {
    return (
      <div className="accounting-report-section">
        <h4>{title}</h4>
        <table className="accounting-table">
          <thead>
            <tr>
              <th>{t("tax.category")}</th>
              <th style={{ textAlign: "right" }}>{t("amount")}</th>
              <th style={{ textAlign: "right" }}>{t("tax.taxAmount")}</th>
              <th style={{ textAlign: "right" }}>{t("tax.netAmount")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t("tax.rate10")}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.taxable10.totalAmount, decimals)}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.taxable10.taxAmount, decimals)}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.taxable10.netAmount, decimals)}</td>
            </tr>
            <tr>
              <td>{t("tax.rate8")}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.taxable8.totalAmount, decimals)}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.taxable8.taxAmount, decimals)}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.taxable8.netAmount, decimals)}</td>
            </tr>
            <tr>
              <td>{t("tax.exempt")}</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.exempt.totalAmount, decimals)}</td>
              <td style={{ textAlign: "right" }}>-</td>
              <td style={{ textAlign: "right" }}>{formatNum(data.exempt.netAmount, decimals)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="accounting-table-total">
              <td><strong>{t("tax.totalTax")}</strong></td>
              <td></td>
              <td style={{ textAlign: "right" }}><strong>{formatNum(data.totalTax, decimals)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="accounting-report">
      <h3>{t("report.consumptionTax")} ({report.dateFrom} ~ {report.dateTo})</h3>
      <TaxSection title={t("tax.sales")} data={report.sales} />
      <TaxSection title={t("tax.purchases")} data={report.purchases} />
      <div className="accounting-report-grand-total">
        <strong>{t("tax.netPayable")}</strong>
        <strong className={report.netTaxPayable < 0 ? "accounting-negative" : ""}>
          {formatNum(report.netTaxPayable, decimals)} {report.currency}
        </strong>
      </div>
    </div>
  );
}

/** General ledger (勘定元帳) view - detail by account */
function GeneralLedgerView({
  ledger,
  dateFrom,
  dateTo,
  currency,
  decimals,
}: {
  ledger: LedgerData;
  dateFrom: string;
  dateTo: string;
  currency: string;
  decimals: number;
}) {
  const [selectedAccount, setSelectedAccount] = React.useState("");

  // Get all accounts sorted
  const accounts = ledger.accounts
    .map((a) => a.name)
    .sort((a, b) => a.localeCompare(b));

  const report = selectedAccount
    ? generateGeneralLedger(ledger, selectedAccount, dateFrom, dateTo, currency)
    : null;

  return (
    <div className="accounting-report">
      <h3>{t("report.generalLedger")} ({dateFrom} ~ {dateTo})</h3>

      <div className="accounting-ledger-selector">
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="accounting-ledger-select"
        >
          <option value="">{t("ledger.selectAccount")}</option>
          {accounts.map((acc) => (
            <option key={acc} value={acc}>
              {tAccount(acc)}
            </option>
          ))}
        </select>
      </div>

      {report && (
        <div className="accounting-report-section">
          <h4>{tAccount(report.account)}</h4>
          <table className="accounting-table">
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("ledger.counterpart")}</th>
                <th>{t("txn.narration")}</th>
                <th style={{ textAlign: "right" }}>{t("table.debit")}</th>
                <th style={{ textAlign: "right" }}>{t("table.credit")}</th>
                <th style={{ textAlign: "right" }}>{t("ledger.balance")}</th>
              </tr>
            </thead>
            <tbody>
              {report.openingBalance !== 0 && (
                <tr className="accounting-ledger-opening">
                  <td></td>
                  <td colSpan={2}><em>{t("ledger.openingBalance")}</em></td>
                  <td style={{ textAlign: "right" }}>
                    {report.openingBalance > 0 ? formatNum(report.openingBalance, decimals) : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {report.openingBalance < 0 ? formatNum(-report.openingBalance, decimals) : ""}
                  </td>
                  <td style={{ textAlign: "right" }} className="accounting-mono">
                    {formatNum(report.openingBalance, decimals)}
                  </td>
                </tr>
              )}
              {report.entries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#888" }}>
                    {t("ledger.noEntries")}
                  </td>
                </tr>
              )}
              {report.entries.map((entry, i) => (
                <tr
                  key={i}
                  className="accounting-ledger-row"
                  onClick={() => setState({ editingTxnId: entry.txnId })}
                >
                  <td className="accounting-txn-date">{entry.date}</td>
                  <td className="accounting-ledger-counterpart">
                    {entry.counterpart.split(", ").map((c) => tAccount(c)).join(", ")}
                  </td>
                  <td>
                    {entry.payee && <span className="accounting-txn-payee">{entry.payee} </span>}
                    {entry.narration}
                  </td>
                  <td style={{ textAlign: "right" }} className="accounting-mono">
                    {entry.debit > 0 ? formatNum(entry.debit, decimals) : ""}
                  </td>
                  <td style={{ textAlign: "right" }} className="accounting-mono">
                    {entry.credit > 0 ? formatNum(entry.credit, decimals) : ""}
                  </td>
                  <td
                    style={{ textAlign: "right" }}
                    className={`accounting-mono ${entry.balance < 0 ? "accounting-negative" : ""}`}
                  >
                    {formatNum(entry.balance, decimals)}
                  </td>
                </tr>
              ))}
            </tbody>
            {report.entries.length > 0 && (
              <tfoot>
                <tr className="accounting-table-total">
                  <td colSpan={3}><strong>{t("report.total")}</strong></td>
                  <td style={{ textAlign: "right" }}>
                    <strong>{formatNum(report.totalDebit, decimals)}</strong>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <strong>{formatNum(report.totalCredit, decimals)}</strong>
                  </td>
                  <td
                    style={{ textAlign: "right" }}
                    className={report.closingBalance < 0 ? "accounting-negative" : ""}
                  >
                    <strong>{formatNum(report.closingBalance, decimals)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

/** Subsidiary ledger (補助元帳) view - detail by payee */
function SubsidiaryLedgerView({
  ledger,
  dateFrom,
  dateTo,
  currency,
  decimals,
}: {
  ledger: LedgerData;
  dateFrom: string;
  dateTo: string;
  currency: string;
  decimals: number;
}) {
  const [selectedPayee, setSelectedPayee] = React.useState("");

  // Collect unique payees from all transactions
  const payees = [...new Set(
    ledger.transactions
      .filter((t) => t.payee)
      .map((t) => t.payee!)
  )].sort();

  const report = selectedPayee
    ? generateSubsidiaryLedger(ledger, selectedPayee, dateFrom, dateTo, currency)
    : null;

  return (
    <div className="accounting-report">
      <h3>{t("report.subsidiaryLedger")} ({dateFrom} ~ {dateTo})</h3>

      <div className="accounting-ledger-selector">
        <select
          value={selectedPayee}
          onChange={(e) => setSelectedPayee(e.target.value)}
          className="accounting-ledger-select"
        >
          <option value="">{t("ledger.selectPayee")}</option>
          {payees.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {payees.length === 0 && (
        <p style={{ color: "#888", textAlign: "center", padding: 24 }}>
          {t("ledger.noPayees")}
        </p>
      )}

      {report && (
        <div className="accounting-report-section">
          <h4>{report.payee}</h4>
          <table className="accounting-table">
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("account")}</th>
                <th>{t("txn.narration")}</th>
                <th style={{ textAlign: "right" }}>{t("table.debit")}</th>
                <th style={{ textAlign: "right" }}>{t("table.credit")}</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#888" }}>
                    {t("ledger.noEntries")}
                  </td>
                </tr>
              )}
              {report.entries.map((entry, i) => (
                <tr
                  key={i}
                  className="accounting-ledger-row"
                  onClick={() => setState({ editingTxnId: entry.txnId })}
                >
                  <td className="accounting-txn-date">{entry.date}</td>
                  <td>{tAccount(entry.account)}</td>
                  <td>{entry.narration}</td>
                  <td style={{ textAlign: "right" }} className="accounting-mono">
                    {entry.debit > 0 ? formatNum(entry.debit, decimals) : ""}
                  </td>
                  <td style={{ textAlign: "right" }} className="accounting-mono">
                    {entry.credit > 0 ? formatNum(entry.credit, decimals) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            {report.entries.length > 0 && (
              <tfoot>
                <tr className="accounting-table-total">
                  <td colSpan={3}><strong>{t("report.total")}</strong></td>
                  <td style={{ textAlign: "right" }}>
                    <strong>{formatNum(report.totalDebit, decimals)}</strong>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <strong>{formatNum(report.totalCredit, decimals)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
