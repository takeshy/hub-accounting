/**
 * LedgerPanel - Sidebar component for transaction entry and account management.
 */

import * as React from "react";
import { t, tFormat, tAccount, setLanguage } from "../i18n";
import { setState, useStore, registerSaveFn } from "../store";
import {
  Transaction,
  Posting,
  Account,
  AccountType,
  ACCOUNT_TYPES,
  LedgerData,
  AccountingSettings,
  DEFAULT_SETTINGS,
  TaxCategory,
} from "../types";
import { parse } from "../core/parser";
import { format } from "../core/formatter";
import {
  addTransaction,
  updateTransaction,
  addAccount,
  createEmptyLedger,
  isBalanced,
  refreshErrors,
} from "../core/ledger";
import { exportFreeeCSV } from "../core/csv";
import { exportToGoogleSheets, SheetsAPI } from "../core/sheets";
import { getFiscalYear, getFiscalYearFileName, getFiscalYearRange, carryForward } from "../core/fiscal";
import { CsvImportDialog } from "./CsvImportDialog";

interface PluginAPI {
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  drive: {
    createFile(name: string, content: string): Promise<{ id: string; name: string }>;
    updateFile(id: string, content: string): Promise<void>;
    readFile(id: string): Promise<string>;
    listFiles(folder?: string): Promise<Array<{ id: string; name: string }>>;
  };
  sheets?: SheetsAPI;
  language?: string;
}

interface LedgerPanelProps {
  api: PluginAPI;
  fileId?: string;
  fileName?: string;
  fileContent?: string;
  language?: string;
}

type PanelView = "main" | "addTransaction" | "addAccount";

export function LedgerPanel(props: LedgerPanelProps) {
  const { api } = props;
  const store = useStore();
  const [view, setView] = React.useState<PanelView>("main");
  const [settings, setSettings] = React.useState<AccountingSettings>(DEFAULT_SETTINGS);

  // Transaction form state
  const [txnDate, setTxnDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [txnPayee, setTxnPayee] = React.useState("");
  const [txnNarration, setTxnNarration] = React.useState("");
  const [txnFlag, setTxnFlag] = React.useState<"*" | "!">("*");

  interface PostingEntry { account: string; amount: number | null; taxCategory?: TaxCategory }
  const emptyEntry = (): PostingEntry => ({ account: "", amount: null });
  const [debitEntries, setDebitEntries] = React.useState<PostingEntry[]>([emptyEntry()]);
  const [creditEntries, setCreditEntries] = React.useState<PostingEntry[]>([emptyEntry()]);
  const [showAllAccounts, setShowAllAccounts] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);

  // Fiscal year state
  const [currentFiscalYear, setCurrentFiscalYear] = React.useState<number>(
    getFiscalYear(new Date().toISOString().slice(0, 10), settings.fiscalYearStartMonth)
  );
  const [availableYears, setAvailableYears] = React.useState<{ year: number; fileId: string }[]>([]);

  // Editing transaction ID (set from MainView's edit button)
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // When MainView sets editingTxnId, populate form and switch to edit view
  React.useEffect(() => {
    const txnId = store.editingTxnId;
    if (!txnId || !ledger) return;
    const txn = ledger.transactions.find((t) => t.id === txnId);
    if (!txn) return;

    setEditingId(txnId);
    setTxnDate(txn.date);
    setTxnPayee(txn.payee || "");
    setTxnNarration(txn.narration);
    setTxnFlag(txn.flag);

    const debits: PostingEntry[] = [];
    const credits: PostingEntry[] = [];
    for (const p of txn.postings) {
      if (p.amount !== null && p.amount < 0) {
        credits.push({ account: p.account, amount: Math.abs(p.amount), taxCategory: p.taxCategory });
      } else {
        debits.push({ account: p.account, amount: p.amount, taxCategory: p.taxCategory });
      }
    }
    setDebitEntries(debits.length > 0 ? debits : [emptyEntry()]);
    setCreditEntries(credits.length > 0 ? credits : [emptyEntry()]);
    setView("addTransaction");
    setState({ editingTxnId: null });
  }, [store.editingTxnId]);

  // Account form state
  const [accName, setAccName] = React.useState("");
  const [accType, setAccType] = React.useState<AccountType>("Expenses");
  const [accDate, setAccDate] = React.useState(new Date().toISOString().slice(0, 10));

  // Language
  React.useEffect(() => {
    if (props.language) setLanguage(props.language);
  }, [props.language]);

  // Load settings once
  React.useEffect(() => {
    (async () => {
      const saved = (await api.storage.get("accountingSettings")) as Partial<AccountingSettings> | null;
      if (saved) {
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        setSettings(merged);
        setState({ settings: merged });
      }
    })();
  }, []);

  // Track the file ID of the current ledger file
  const fileIdRef = React.useRef<string | null>(props.fileId || null);

  // Load ledger from file content (when opened via FileTree)
  React.useEffect(() => {
    if (props.fileContent) {
      if (props.fileId) fileIdRef.current = props.fileId;
      const ledger = refreshErrors(parse(props.fileContent));
      setState({ ledger, fileName: props.fileName || "ledger.beancount" });
    }
  }, [props.fileContent, props.fileName]);

  // Scan all drive files for .beancount files in our directory
  React.useEffect(() => {
    if (props.fileContent) return;
    (async () => {
      try {
        const dir = settings.directory;
        const prefix = dir ? `${dir}/` : "";
        const allFiles = await api.drive.listFiles();
        const years: { year: number; fileId: string }[] = [];
        for (const f of allFiles) {
          // Match "accounting/2026.beancount" or "2026.beancount"
          const name = f.name;
          const match = name.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{4})\\.beancount$`));
          if (match) {
            years.push({ year: Number(match[1]), fileId: f.id });
          }
        }
        if (years.length === 0) return;
        years.sort((a, b) => b.year - a.year);
        setAvailableYears(years);

        const thisYear = getFiscalYear(new Date().toISOString().slice(0, 10), settings.fiscalYearStartMonth);
        const target = years.find((y) => y.year === thisYear) || years[0];
        fileIdRef.current = target.fileId;
        setCurrentFiscalYear(target.year);
        const content = await api.drive.readFile(target.fileId);
        const ledger = refreshErrors(parse(content));
        setState({ ledger, fileName: `${target.year}.beancount` });
      } catch {
        // no files found
      }
    })();
  }, []);

  const ledger = store.ledger;

  async function handleNewLedger() {
    const template = settings.defaultCurrency === "JPY" ? "japan_sole_proprietor" : "default";
    const newLedger = createEmptyLedger(settings.defaultCurrency, template);
    const text = format(newLedger, settings.decimalPlaces);
    const year = getFiscalYear(new Date().toISOString().slice(0, 10), settings.fiscalYearStartMonth);
    const fileName = getFiscalYearFileName(year, settings.directory);
    const file = await api.drive.createFile(fileName, text);
    fileIdRef.current = file.id;
    setCurrentFiscalYear(year);
    setAvailableYears((prev) => [...prev, { year, fileId: file.id }].sort((a, b) => b.year - a.year));
    setState({ ledger: newLedger, fileName: `${year}.beancount` });
  }

  async function saveLedger(l: LedgerData) {
    const text = format(l, settings.decimalPlaces);
    if (fileIdRef.current) {
      await api.drive.updateFile(fileIdRef.current, text);
    } else {
      const file = await api.drive.createFile("ledger.beancount", text);
      fileIdRef.current = file.id;
    }
  }

  // Register save function so MainView can also trigger saves
  React.useEffect(() => { registerSaveFn(saveLedger); }, []);

  /** Check if an account is Income or Expenses (tax-relevant) */
  function isTaxRelevantAccount(accountName: string): boolean {
    if (!ledger) return false;
    const acc = ledger.accounts.find((a) => a.name === accountName);
    return acc ? acc.type === "Income" || acc.type === "Expenses" : false;
  }

  function handleEntryChange(
    side: "debit" | "credit",
    idx: number,
    field: string,
    value: string
  ) {
    const setter = side === "debit" ? setDebitEntries : setCreditEntries;
    const otherSetter = side === "debit" ? setCreditEntries : setDebitEntries;
    const otherEntries = side === "debit" ? creditEntries : debitEntries;
    setter((prev) => {
      const next = [...prev];
      if (field === "amount") {
        next[idx] = { ...next[idx], amount: value === "" ? null : Number(value) };
      } else if (field === "taxCategory") {
        next[idx] = { ...next[idx], taxCategory: value ? (value as TaxCategory) : undefined };
      } else if (field === "account") {
        // Clear taxCategory when switching to a non-tax-relevant account
        const newEntry = { ...next[idx], account: value };
        const acc = ledger?.accounts.find((a) => a.name === value);
        if (acc && acc.type !== "Income" && acc.type !== "Expenses") {
          newEntry.taxCategory = undefined;
        }
        next[idx] = newEntry;
        // Auto-fill amount from the other side when selecting account
        if (next.length === 1 && otherEntries.length === 1 && newEntry.amount === null && otherEntries[0].amount !== null) {
          next[idx] = { ...next[idx], ...newEntry, amount: otherEntries[0].amount };
        }
      }
      return next;
    });
  }

  function handleAddEntry(side: "debit" | "credit") {
    const setter = side === "debit" ? setDebitEntries : setCreditEntries;
    setter((prev) => [...prev, emptyEntry()]);
  }

  function handleRemoveEntry(side: "debit" | "credit", idx: number) {
    const setter = side === "debit" ? setDebitEntries : setCreditEntries;
    setter((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }

  function handleSubmitTransaction() {
    if (!ledger) return;

    const cur = settings.defaultCurrency;
    const postings: Posting[] = [
      ...debitEntries.filter((e) => e.account).map((e) => ({
        account: e.account,
        amount: e.amount,
        currency: cur,
        ...(e.taxCategory ? { taxCategory: e.taxCategory } : {}),
      })),
      ...creditEntries.filter((e) => e.account).map((e) => ({
        account: e.account,
        amount: e.amount !== null ? -Math.abs(e.amount) : null,
        currency: cur,
        ...(e.taxCategory ? { taxCategory: e.taxCategory } : {}),
      })),
    ];

    const txn: Omit<Transaction, "id"> = {
      date: txnDate,
      flag: txnFlag,
      payee: txnPayee || undefined,
      narration: txnNarration,
      postings,
      tags: [],
      links: [],
    };

    if (!isBalanced(txn as Transaction)) {
      alert(t("error.unbalanced"));
      return;
    }

    let newLedger: LedgerData;
    if (editingId) {
      newLedger = updateTransaction(ledger, editingId, txn);
    } else {
      newLedger = addTransaction(ledger, txn);
    }
    setState({ ledger: newLedger });
    saveLedger(newLedger);

    // Reset form
    setEditingId(null);
    setTxnPayee("");
    setTxnNarration("");
    setDebitEntries([emptyEntry()]);
    setCreditEntries([emptyEntry()]);
    setView("main");
  }

  /** Filter accounts by side: debit=Expenses+Assets, credit=Assets+Liabilities+Income */
  function accountsForSide(side: "debit" | "credit") {
    if (showAllAccounts) return ledger!.accounts;
    const debitTypes = new Set(["Expenses", "Assets"]);
    const creditTypes = new Set(["Assets", "Liabilities", "Income", "Equity"]);
    const allowed = side === "debit" ? debitTypes : creditTypes;
    return ledger!.accounts.filter((a) => allowed.has(a.type));
  }

  function renderPostingGroup(side: "debit" | "credit", label: string, entries: PostingEntry[]) {
    const accounts = accountsForSide(side);
    return (
      <div>
        <h4>{label}</h4>
        {entries.map((e, i) => (
          <div key={i} className="accounting-posting-row">
            <select
              value={e.account}
              onChange={(ev) => handleEntryChange(side, i, "account", ev.target.value)}
            >
              <option value="">{t("account")}</option>
              {accounts.map((a) => (
                <option key={a.name} value={a.name}>{tAccount(a.name)}</option>
              ))}
            </select>
            <input
              type="number"
              value={e.amount === null ? "" : e.amount}
              onChange={(ev) => handleEntryChange(side, i, "amount", ev.target.value)}
              placeholder={t("amount")}
              style={{ width: 100 }}
            />
            {isTaxRelevantAccount(e.account) && (
              <select
                value={e.taxCategory || ""}
                onChange={(ev) => handleEntryChange(side, i, "taxCategory", ev.target.value)}
                style={{ width: 80 }}
              >
                <option value="">{t("tax.none")}</option>
                <option value="taxable_10">{t("tax.taxable_10")}</option>
                <option value="taxable_8">{t("tax.taxable_8")}</option>
                <option value="exempt">{t("tax.exempt")}</option>
                <option value="non_taxable">{t("tax.non_taxable")}</option>
                <option value="tax_free">{t("tax.tax_free")}</option>
              </select>
            )}
            {entries.length > 1 && (
              <button
                className="accounting-btn accounting-btn-sm"
                onClick={() => handleRemoveEntry(side, i)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="accounting-btn accounting-btn-sm" onClick={() => handleAddEntry(side)}>
          + {t("add")}
        </button>
      </div>
    );
  }

  function handleSubmitAccount() {
    if (!ledger || !accName) return;

    const fullName = `${accType}:${accName}`;
    const account: Account = {
      name: fullName,
      type: accType,
      openDate: accDate,
      currencies: [settings.defaultCurrency],
    };

    const newLedger = addAccount(ledger, account);
    setState({ ledger: newLedger });
    saveLedger(newLedger);
    setAccName("");
    setView("main");
  }

  async function handleExportFreeeCSV() {
    if (!ledger) return;
    const { start, end } = getFiscalYearRange(currentFiscalYear, settings.fiscalYearStartMonth);
    const csv = exportFreeeCSV(ledger, start, end, settings.defaultCurrency, t);
    await api.drive.createFile(`freee_${currentFiscalYear}.csv`, csv);
  }

  const [exporting, setExporting] = React.useState(false);

  async function handleExportGoogleSheets() {
    if (!ledger || !api.sheets) return;
    setExporting(true);
    try {
      const { start, end } = getFiscalYearRange(currentFiscalYear, settings.fiscalYearStartMonth);
      const url = await exportToGoogleSheets(
        api.sheets, ledger, currentFiscalYear, start, end, settings.defaultCurrency, t
      );
      window.open(url, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleSwitchYear(year: number) {
    const entry = availableYears.find((y) => y.year === year);
    if (!entry) return;
    try {
      // Save current year before switching
      if (ledger) await saveLedger(ledger);
      const content = await api.drive.readFile(entry.fileId);
      const newLedger = refreshErrors(parse(content));
      fileIdRef.current = entry.fileId;
      setCurrentFiscalYear(year);
      setState({ ledger: newLedger, fileName: `${year}.beancount` });
    } catch {
      // read error
    }
  }

  async function handleCarryForward() {
    if (!ledger) return;
    const nextYear = currentFiscalYear + 1;
    if (!confirm(tFormat("fiscal.carryForwardConfirm", nextYear))) return;

    const newLedger = carryForward(ledger, nextYear, settings.fiscalYearStartMonth, settings.defaultCurrency);
    const text = format(newLedger, settings.decimalPlaces);
    const fileName = getFiscalYearFileName(nextYear, settings.directory);
    const file = await api.drive.createFile(fileName, text);

    fileIdRef.current = file.id;
    setCurrentFiscalYear(nextYear);
    setAvailableYears((prev) =>
      [...prev, { year: nextYear, fileId: file.id }].sort((a, b) => b.year - a.year)
    );
    setState({ ledger: newLedger, fileName: `${nextYear}.beancount` });
  }

  // --- Render ---

  if (!ledger) {
    return (
      <div className="accounting-panel">
        <h3>{t("plugin.name")}</h3>
        <p style={{ color: "#888", fontSize: 13 }}>
          {t("file.new")}
        </p>
        <button className="accounting-btn accounting-btn-primary" onClick={handleNewLedger}>
          {t("file.new")}
        </button>
      </div>
    );
  }

  if (view === "addTransaction") {
    return (
      <div className="accounting-panel">
        <h3>{editingId ? t("txn.edit") : t("txn.new")}</h3>
        <div className="accounting-form">
          <label>{t("date")}</label>
          <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />

          <label>{t("txn.payee")}</label>
          <input
            type="text"
            value={txnPayee}
            onChange={(e) => setTxnPayee(e.target.value)}
            placeholder={t("txn.payee")}
          />

          <label>{t("txn.narration")}</label>
          <input
            type="text"
            value={txnNarration}
            onChange={(e) => setTxnNarration(e.target.value)}
            placeholder={t("txn.narration")}
          />

          <label>
            <input
              type="checkbox"
              checked={txnFlag === "!"}
              onChange={(e) => setTxnFlag(e.target.checked ? "!" : "*")}
            />
            {" "}{t("txn.flag.incomplete")}
          </label>

          <label>
            <input
              type="checkbox"
              checked={showAllAccounts}
              onChange={(e) => setShowAllAccounts(e.target.checked)}
            />
            {" "}{t("txn.showAllAccounts")}
          </label>

          {renderPostingGroup("debit", t("table.debit"), debitEntries)}
          {renderPostingGroup("credit", t("table.credit"), creditEntries)}
        </div>

        <div className="accounting-form-actions">
          <button className="accounting-btn accounting-btn-primary" onClick={handleSubmitTransaction}>
            {t("save")}
          </button>
          <button className="accounting-btn" onClick={() => { setEditingId(null); setView("main"); }}>
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (view === "addAccount") {
    return (
      <div className="accounting-panel">
        <h3>{t("accounts.open")}</h3>
        <div className="accounting-form">
          <label>{t("accounts.type")}</label>
          <select value={accType} onChange={(e) => setAccType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((at) => (
              <option key={at} value={at}>{t(`account.${at.toLowerCase()}`)}</option>
            ))}
          </select>

          <label>{t("accounts.name")}</label>
          <input
            type="text"
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
            placeholder={t("accounts.nameExample")}
          />

          <label>{t("date")}</label>
          <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} />
        </div>

        <div className="accounting-form-actions">
          <button className="accounting-btn accounting-btn-primary" onClick={handleSubmitAccount}>
            {t("save")}
          </button>
          <button className="accounting-btn" onClick={() => setView("main")}>
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="accounting-panel">
      <h3>{t("plugin.name")}</h3>

      <div className="accounting-actions" style={{ alignItems: "center" }}>
        {availableYears.length > 1 ? (
          <select
            value={currentFiscalYear}
            onChange={(e) => handleSwitchYear(Number(e.target.value))}
            style={{ fontSize: 14, fontWeight: 600, padding: "4px 8px" }}
          >
            {availableYears.map((y) => (
              <option key={y.year} value={y.year}>{tFormat("fiscal.year", y.year)}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600 }}>{tFormat("fiscal.year", currentFiscalYear)}</span>
        )}
        <button className="accounting-btn accounting-btn-sm" onClick={handleCarryForward} title={t("fiscal.carryForward")}>
          {t("fiscal.carryForward")}
        </button>
      </div>

      <div className="accounting-actions">
        <button className="accounting-btn accounting-btn-primary" onClick={() => setView("addTransaction")}>
          + {t("txn.new")}
        </button>
        <button className="accounting-btn" onClick={() => setView("addAccount")}>
          + {t("accounts.open")}
        </button>
      </div>

      <div className="accounting-stats">
        <div className="accounting-stat">
          <span className="accounting-stat-label">{t("accounts.list")}</span>
          <span className="accounting-stat-value">{ledger.accounts.length}</span>
        </div>
        <div className="accounting-stat">
          <span className="accounting-stat-label">{t("report.journal")}</span>
          <span className="accounting-stat-value">{ledger.transactions.length}</span>
        </div>
      </div>

      {ledger.errors.length > 0 && (
        <div className="accounting-errors">
          {ledger.errors.slice(0, 5).map((e, i) => (
            <div key={i} className={`accounting-error accounting-error-${e.severity}`}>
              {e.message}
            </div>
          ))}
        </div>
      )}

      <h4>{t("accounts.list")}</h4>
      <div className="accounting-account-list">
        {ledger.accounts.map((a) => (
          <div key={a.name} className="accounting-account-item">
            <span className={`accounting-account-type accounting-type-${a.type.toLowerCase()}`}>
              {t(`account.${a.type.toLowerCase()}.short`)}
            </span>
            <span className="accounting-account-name">{tAccount(a.name)}</span>
          </div>
        ))}
      </div>

      <div className="accounting-actions" style={{ marginTop: 16 }}>
        <button className="accounting-btn accounting-btn-primary" onClick={() => setShowImport(true)}>
          {t("import.csv")}
        </button>
        <button className="accounting-btn" onClick={handleExportFreeeCSV}>
          {t("export.freeeCSV")}
        </button>
        {api.sheets && (
          <button className="accounting-btn" onClick={handleExportGoogleSheets} disabled={exporting}>
            {exporting ? t("export.exporting") : t("export.googleSheets")}
          </button>
        )}
      </div>

      {showImport && (
        <CsvImportDialog
          ledger={ledger}
          settings={settings}
          onImport={(newLedger) => {
            setState({ ledger: newLedger });
            saveLedger(newLedger);
            setShowImport(false);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
