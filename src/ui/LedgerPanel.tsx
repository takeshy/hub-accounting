/**
 * LedgerPanel - Sidebar component for transaction entry and account management.
 */

import * as React from "react";
import { t, setLanguage } from "../i18n";
import { setState, useStore } from "../store";
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
  TAX_CATEGORIES,
} from "../types";
import { parse } from "../core/parser";
import { format } from "../core/formatter";
import {
  addTransaction,
  addAccount,
  createEmptyLedger,
  isBalanced,
  refreshErrors,
} from "../core/ledger";
import { exportFreeeCSV } from "../core/csv";

interface PluginAPI {
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  drive: {
    createFile(name: string, content: string): Promise<{ id: string; name: string }>;
  };
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
  const [postings, setPostings] = React.useState<Posting[]>([
    { account: "", amount: null, currency: "" },
    { account: "", amount: null, currency: "" },
  ]);

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
      const saved = (await api.storage.get("accountingSettings")) as AccountingSettings | null;
      if (saved) {
        setSettings(saved);
        setState({ settings: saved });
      }
    })();
  }, []);

  // Track whether a file-backed ledger has been loaded so the storage
  // fallback never overwrites it if the async read finishes late.
  const fileLoadedRef = React.useRef(false);

  // Load ledger from file content
  React.useEffect(() => {
    if (props.fileContent) {
      fileLoadedRef.current = true;
      const ledger = refreshErrors(parse(props.fileContent));
      setState({ ledger, fileName: props.fileName || "ledger.beancount" });
    }
  }, [props.fileContent, props.fileName]);

  // Fallback: load from storage on mount when no file is open
  React.useEffect(() => {
    if (props.fileContent) return;
    (async () => {
      const savedLedger = (await api.storage.get("ledgerData")) as string | null;
      if (savedLedger && !fileLoadedRef.current) {
        const ledger = refreshErrors(parse(savedLedger));
        setState({ ledger, fileName: "ledger.beancount" });
      }
    })();
  }, []);

  const ledger = store.ledger;

  function handleNewLedger() {
    const template = settings.defaultCurrency === "JPY" ? "japan_sole_proprietor" : "default";
    const newLedger = createEmptyLedger(settings.defaultCurrency, template);
    setState({ ledger: newLedger, fileName: "ledger.beancount" });
    saveLedger(newLedger);
  }

  async function saveLedger(l: LedgerData) {
    const text = format(l, settings.decimalPlaces);
    await api.storage.set("ledgerData", text);
  }

  function handleAddPosting() {
    setPostings([...postings, { account: "", amount: null, currency: settings.defaultCurrency }]);
  }

  function handleRemovePosting(idx: number) {
    if (postings.length <= 2) return;
    setPostings(postings.filter((_, i) => i !== idx));
  }

  function handlePostingChange(idx: number, field: keyof Posting, value: string) {
    const newPostings = [...postings];
    if (field === "amount") {
      newPostings[idx] = { ...newPostings[idx], amount: value === "" ? null : Number(value) };
    } else if (field === "taxCategory") {
      newPostings[idx] = { ...newPostings[idx], taxCategory: value ? (value as TaxCategory) : undefined };
    } else {
      newPostings[idx] = { ...newPostings[idx], [field]: value };
    }
    setPostings(newPostings);
  }

  function handleSubmitTransaction() {
    if (!ledger) return;

    const filledPostings = postings.map((p) => ({
      ...p,
      currency: p.currency || settings.defaultCurrency,
      ...(p.taxCategory ? { taxCategory: p.taxCategory } : {}),
    }));

    const txn: Omit<Transaction, "id"> = {
      date: txnDate,
      flag: txnFlag,
      payee: txnPayee || undefined,
      narration: txnNarration,
      postings: filledPostings,
      tags: [],
      links: [],
    };

    if (!isBalanced(txn as Transaction)) {
      alert(t("error.unbalanced"));
      return;
    }

    const newLedger = addTransaction(ledger, txn);
    setState({ ledger: newLedger });
    saveLedger(newLedger);

    // Reset form
    setTxnPayee("");
    setTxnNarration("");
    setPostings([
      { account: "", amount: null, currency: settings.defaultCurrency },
      { account: "", amount: null, currency: settings.defaultCurrency },
    ]);
    setView("main");
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

  async function handleExport() {
    if (!ledger) return;
    const text = format(ledger, settings.decimalPlaces);
    await api.drive.createFile("ledger.beancount", text);
  }

  async function handleExportFreeeCSV() {
    if (!ledger) return;
    const csv = exportFreeeCSV(ledger, "", "9999-12-31", settings.defaultCurrency, t);
    await api.drive.createFile("freee_journal.csv", csv);
  }

  async function handleSave() {
    if (!ledger) return;
    await saveLedger(ledger);
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
        <h3>{t("txn.new")}</h3>
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

          <h4>{t("txn.postings")}</h4>
          {postings.map((p, i) => (
            <div key={i} className="accounting-posting-row">
              <select
                value={p.account}
                onChange={(e) => handlePostingChange(i, "account", e.target.value)}
              >
                <option value="">{t("account")}</option>
                {ledger.accounts.map((a) => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={p.amount === null ? "" : p.amount}
                onChange={(e) => handlePostingChange(i, "amount", e.target.value)}
                placeholder={t("amount")}
                style={{ width: 100 }}
              />
              <input
                type="text"
                value={p.currency || settings.defaultCurrency}
                onChange={(e) => handlePostingChange(i, "currency", e.target.value)}
                style={{ width: 50 }}
              />
              <select
                value={p.taxCategory || ""}
                onChange={(e) => handlePostingChange(i, "taxCategory", e.target.value)}
                style={{ width: 80 }}
              >
                <option value="">{t("tax.none")}</option>
                <option value="taxable_10">{t("tax.taxable_10")}</option>
                <option value="taxable_8">{t("tax.taxable_8")}</option>
                <option value="exempt">{t("tax.exempt")}</option>
                <option value="non_taxable">{t("tax.non_taxable")}</option>
                <option value="tax_free">{t("tax.tax_free")}</option>
              </select>
              {postings.length > 2 && (
                <button
                  className="accounting-btn accounting-btn-sm"
                  onClick={() => handleRemovePosting(i)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="accounting-btn accounting-btn-sm" onClick={handleAddPosting}>
            + {t("txn.addPosting")}
          </button>
        </div>

        <div className="accounting-form-actions">
          <button className="accounting-btn accounting-btn-primary" onClick={handleSubmitTransaction}>
            {t("save")}
          </button>
          <button className="accounting-btn" onClick={() => setView("main")}>
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
              {a.type.slice(0, 3)}
            </span>
            <span className="accounting-account-name">{a.name}</span>
          </div>
        ))}
      </div>

      <div className="accounting-actions" style={{ marginTop: 16 }}>
        <button className="accounting-btn" onClick={handleSave}>
          {t("file.save")}
        </button>
        <button className="accounting-btn" onClick={handleExport}>
          {t("file.export")}
        </button>
        <button className="accounting-btn" onClick={handleExportFreeeCSV}>
          {t("export.freeeCSV")}
        </button>
      </div>
    </div>
  );
}
