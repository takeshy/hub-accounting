/**
 * Accounting - Beancount-compatible Double-Entry Bookkeeping Plugin for GemiHub
 *
 * Manages accounts, records transactions using double-entry bookkeeping,
 * and generates financial reports (balance sheet, income statement, trial balance).
 */

import { LedgerPanel } from "./ui/LedgerPanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { MainView } from "./ui/MainView";
import { JournalTemplate } from "./types";
import { getDefaultTemplates } from "./core/templates";
import { setState } from "./store";

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

    // Load templates from storage (async, fire-and-forget)
    (async () => {
      try {
        const saved = await api.storage.get("journalTemplates") as JournalTemplate[] | null;
        // null = never saved → init with defaults.  Array (even empty) = user's intent.
        const templates = Array.isArray(saved) ? saved : getDefaultTemplates();
        setState({ templates });
        if (!Array.isArray(saved)) {
          await api.storage.set("journalTemplates", templates);
        }
      } catch {
        setState({ templates: getDefaultTemplates() });
      }
    })();
  }

  onunload(): void {
    // cleanup handled by host
  }
}

module.exports = AccountingPlugin;
