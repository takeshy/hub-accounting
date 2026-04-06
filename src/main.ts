/**
 * Accounting - Beancount-compatible Double-Entry Bookkeeping Plugin for GemiHub
 *
 * Manages accounts, records transactions using double-entry bookkeeping,
 * and generates financial reports (balance sheet, income statement, trial balance).
 */

import { LedgerPanel } from "./ui/LedgerPanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { MainView } from "./ui/MainView";

interface PluginAPI {
  registerView(view: {
    id: string;
    name: string;
    icon?: string;
    location: "sidebar" | "main";
    extensions?: string[];
    component: unknown;
  }): void;
  registerSettingsTab(tab: {
    component: unknown;
  }): void;
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
}

class AccountingPlugin {
  onload(api: PluginAPI): void {
    api.registerView({
      id: "accounting",
      name: "Accounting",
      location: "sidebar",
      component: LedgerPanel,
    });

    api.registerView({
      id: "accounting-main",
      name: "Accounting",
      location: "main",
      extensions: [".beancount", ".bean", ".ledger"],
      component: MainView,
    });

    api.registerSettingsTab({
      component: SettingsPanel,
    });
  }

  onunload(): void {
    // cleanup handled by host
  }
}

module.exports = AccountingPlugin;
