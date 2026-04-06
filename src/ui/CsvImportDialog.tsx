/**
 * CsvImportDialog - Modal dialog for importing bank CSV files.
 */

import * as React from "react";
import { t, tFormat, tAccount } from "../i18n";
import { LedgerData, AccountingSettings } from "../types";
import {
  BANK_PRESETS,
  BankFormatPreset,
  ParsedRow,
  decodeFile,
  detectFormat,
  parseCSV,
  importRows,
} from "../core/csv-import";

interface CsvImportDialogProps {
  ledger: LedgerData;
  settings: AccountingSettings;
  onImport: (newLedger: LedgerData) => void;
  onClose: () => void;
}

type Step = "file" | "preview";

export function CsvImportDialog({ ledger, settings, onImport, onClose }: CsvImportDialogProps) {
  const [step, setStep] = React.useState<Step>("file");
  const [presetId, setPresetId] = React.useState("generic");
  const [bankAccount, setBankAccount] = React.useState("");
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null);
  const [error, setError] = React.useState("");

  // Available bank accounts (Assets + Liabilities)
  const bankAccounts = ledger.accounts.filter(
    (a) => a.type === "Assets" || a.type === "Liabilities"
  );

  // Set default bank account
  React.useEffect(() => {
    if (!bankAccount && bankAccounts.length > 0) {
      const deposit = bankAccounts.find((a) => a.name === "Assets:OrdinaryDeposit");
      setBankAccount(deposit ? deposit.name : bankAccounts[0].name);
    }
  }, [bankAccounts]);

  const preset = BANK_PRESETS.find((p) => p.id === presetId) || BANK_PRESETS[0];

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Size check: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      setFileBuffer(buffer);

      // Auto-detect format from first line
      const text = decodeFile(buffer, "UTF-8");
      const firstLine = text.split(/\r?\n/)[0] || "";
      const detected = detectFormat(firstLine);
      if (detected) setPresetId(detected);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsArrayBuffer(file);
  }

  function handleParse() {
    if (!fileBuffer) return;
    setError("");
    try {
      const text = decodeFile(fileBuffer, preset.encoding);
      const parsed = parseCSV(text, preset);
      if (parsed.length === 0) {
        setError(t("import.noData"));
        return;
      }
      setRows(parsed);
      setStep("preview");
    } catch {
      setError(t("import.noData"));
    }
  }

  function handleRowToggle(idx: number) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }

  function handleToggleAll() {
    const allEnabled = rows.every((r) => r.enabled);
    setRows((prev) => prev.map((r) => ({ ...r, enabled: !allEnabled })));
  }

  function handleCounterpartChange(idx: number, account: string) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, counterpartAccount: account } : r));
  }

  function handleImport() {
    const newLedger = importRows(ledger, rows, bankAccount, settings.defaultCurrency);
    const count = rows.filter((r) => r.enabled).length;
    onImport(newLedger);
    alert(tFormat("import.importSuccess", count));
  }

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <div className="accounting-dialog-overlay" onClick={onClose}>
      <div className="accounting-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="accounting-dialog-header">
          <h3>{t("import.csv")}</h3>
          <button className="accounting-btn accounting-btn-sm" onClick={onClose}>×</button>
        </div>

        <div className="accounting-dialog-body">
          {step === "file" && (
            <div className="accounting-form">
              <label>{t("import.selectFile")}</label>
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect} />

              <label>{t("import.bankAccount")}</label>
              <select value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}>
                {bankAccounts.map((a) => (
                  <option key={a.name} value={a.name}>{tAccount(a.name)}</option>
                ))}
              </select>

              <label>{t("import.format")}</label>
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                {BANK_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{t(p.nameKey)}</option>
                ))}
              </select>

              {error && <div className="accounting-error accounting-error-error">{error}</div>}
            </div>
          )}

          {step === "preview" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>{tFormat("import.rowCount", enabledCount, rows.length)}</span>
                <button className="accounting-btn accounting-btn-sm" onClick={handleToggleAll}>
                  {rows.every((r) => r.enabled) ? t("import.deselectAll") : t("import.selectAll")}
                </button>
              </div>
              <div className="accounting-import-preview">
                <table className="accounting-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{t("date")}</th>
                      <th>{t("txn.narration")}</th>
                      <th style={{ textAlign: "right" }}>{t("import.withdrawal")}</th>
                      <th style={{ textAlign: "right" }}>{t("import.deposit")}</th>
                      <th>{t("import.counterpart")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={row.enabled ? "" : "accounting-import-row-disabled"}>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={() => handleRowToggle(i)}
                          />
                        </td>
                        <td>{row.date}</td>
                        <td>{row.description}</td>
                        <td style={{ textAlign: "right" }} className={row.withdrawal > 0 ? "accounting-negative" : ""}>
                          {row.withdrawal > 0 ? row.withdrawal.toLocaleString() : ""}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {row.deposit > 0 ? row.deposit.toLocaleString() : ""}
                        </td>
                        <td>
                          <select
                            value={row.counterpartAccount}
                            onChange={(e) => handleCounterpartChange(i, e.target.value)}
                          >
                            {ledger.accounts.map((a) => (
                              <option key={a.name} value={a.name}>{tAccount(a.name)}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="accounting-dialog-footer">
          {step === "preview" && (
            <button className="accounting-btn" onClick={() => setStep("file")}>
              {t("import.back")}
            </button>
          )}
          {step === "file" && (
            <button
              className="accounting-btn accounting-btn-primary"
              onClick={handleParse}
              disabled={!fileBuffer}
            >
              {t("import.next")}
            </button>
          )}
          {step === "preview" && (
            <button
              className="accounting-btn accounting-btn-primary"
              onClick={handleImport}
              disabled={enabledCount === 0}
            >
              {t("import.confirm")} ({enabledCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
