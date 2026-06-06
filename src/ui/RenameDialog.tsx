/**
 * RenameDialog - Dialog for renaming accounts, tags, links, currencies.
 */

import * as React from "react";
import { t, tFormat } from "../i18n";
import { LedgerData } from "../types";
import { rename, isValidNewName, RenameTarget } from "../core/rename";

interface RenameDialogProps {
  ledger: LedgerData;
  target: RenameTarget;
  oldName: string;
  onRename: (newLedger: LedgerData) => void;
  onClose: () => void;
}

export function RenameDialog(props: RenameDialogProps) {
  const { ledger, target, oldName, onRename, onClose } = props;
  const [newName, setNewName] = React.useState(oldName);
  const [error, setError] = React.useState("");

  const titleKey = `rename.${target}`;

  function handleSubmit() {
    if (!isValidNewName(target, newName)) {
      setError(t("rename.error.invalid"));
      return;
    }

    try {
      const result = rename(ledger, target, oldName, newName);
      if (result.changedCount === 0) {
        onClose();
        return;
      }
      if (!confirm(tFormat("rename.confirm", oldName, newName, result.changedCount))) {
        return;
      }
      onRename(result.ledger);
      alert(tFormat("rename.success", result.changedCount));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="accounting-dialog-overlay" onClick={onClose}>
      <div className="accounting-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="accounting-dialog-header">
          <h3>{t(titleKey)}</h3>
          <button className="accounting-btn accounting-btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="accounting-dialog-body">
          <div className="accounting-form">
            <label>{t("rename.newName")}</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError("");
              }}
              autoFocus
            />
            {error && <div className="accounting-error accounting-error-error">{error}</div>}
          </div>
        </div>
        <div className="accounting-dialog-footer">
          <button className="accounting-btn" onClick={onClose}>{t("cancel")}</button>
          <button
            className="accounting-btn accounting-btn-primary"
            onClick={handleSubmit}
            disabled={!newName || newName === oldName}
          >
            {t("rename")}
          </button>
        </div>
      </div>
    </div>
  );
}
