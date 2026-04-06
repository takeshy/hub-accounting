/**
 * SettingsPanel - Plugin settings for accounting configuration.
 */

import * as React from "react";
import { t, setLanguage } from "../i18n";
import { setState, useStore } from "../store";
import { AccountingSettings, DEFAULT_SETTINGS } from "../types";

interface PluginAPI {
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  language?: string;
}

interface SettingsPanelProps {
  api: PluginAPI;
  language?: string;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [settings, setLocalSettings] = React.useState<AccountingSettings>(DEFAULT_SETTINGS);

  React.useEffect(() => {
    if (props.language) setLanguage(props.language);
  }, [props.language]);

  React.useEffect(() => {
    (async () => {
      const saved = (await props.api.storage.get("accountingSettings")) as Partial<AccountingSettings> | null;
      if (saved) {
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        setLocalSettings(merged);
        setState({ settings: merged });
      }
    })();
  }, []);

  async function handleSave() {
    await props.api.storage.set("accountingSettings", settings);
    setState({ settings });
  }

  function handleReset() {
    setLocalSettings(DEFAULT_SETTINGS);
  }

  return (
    <div className="accounting-settings">
      <h3>{t("plugin.name")} - {t("settings.title")}</h3>

      <div className="accounting-form">
        <label>{t("settings.defaultCurrency")}</label>
        <input
          type="text"
          value={settings.defaultCurrency}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setLocalSettings((prev) => ({ ...prev, defaultCurrency: v }));
          }}
          placeholder="JPY"
          maxLength={5}
        />

        <label>{t("settings.dateFormat")}</label>
        <select
          value={settings.dateFormat}
          onChange={(e) => {
            const v = e.target.value as AccountingSettings["dateFormat"];
            setLocalSettings((prev) => ({ ...prev, dateFormat: v }));
          }}
        >
          <option value="yyyy-MM-dd">yyyy-MM-dd</option>
          <option value="dd/MM/yyyy">dd/MM/yyyy</option>
          <option value="MM/dd/yyyy">MM/dd/yyyy</option>
        </select>

        <label>{t("settings.decimalPlaces")}</label>
        <select
          value={settings.decimalPlaces}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLocalSettings((prev) => ({ ...prev, decimalPlaces: v }));
          }}
        >
          <option value={0}>0</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        <label>{t("settings.directory")}</label>
        <input
          type="text"
          value={settings.directory}
          onChange={(e) => {
            setLocalSettings((prev) => ({ ...prev, directory: e.target.value }));
          }}
          placeholder="accounting"
        />

        <label>{t("settings.fiscalYearStart")}</label>
        <select
          value={settings.fiscalYearStartMonth}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLocalSettings((prev) => ({ ...prev, fiscalYearStartMonth: v }));
          }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="accounting-form-actions">
        <button className="accounting-btn accounting-btn-primary" onClick={handleSave}>
          {t("save")}
        </button>
        <button className="accounting-btn" onClick={handleReset}>
          {t("reset")}
        </button>
      </div>
    </div>
  );
}
