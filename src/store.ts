/**
 * Module-level shared state store (pub/sub).
 * Bridges sidebar (LedgerPanel) and main view (MainView) across separate React trees.
 */

import * as React from "react";
import { LedgerData, ReportType, AccountingSettings, DEFAULT_SETTINGS, JournalTemplate } from "./types";

export interface StoreState {
  ledger: LedgerData | null;
  fileName: string;
  activeReport: ReportType;
  settings: AccountingSettings;
  filterDateFrom: string;
  filterDateTo: string;
  filterAccount: string;
  filterQuery: string;
  editingTxnId: string | null;
  templates: JournalTemplate[];
}

type Listener = (state: StoreState) => void;

const initialState: StoreState = {
  ledger: null,
  fileName: "",
  activeReport: "dashboard",
  settings: DEFAULT_SETTINGS,
  filterDateFrom: "",
  filterDateTo: "",
  filterAccount: "",
  filterQuery: "",
  editingTxnId: null,
  templates: [],
};

let state: StoreState = { ...initialState };
const listeners = new Set<Listener>();

export function getState(): StoreState {
  return state;
}

export function setState(partial: Partial<StoreState>): void {
  state = { ...state, ...partial };
  for (const fn of listeners) fn(state);
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Registered save function for cross-component saving */
let saveFn: ((ledger: LedgerData) => Promise<void>) | null = null;

export function registerSaveFn(fn: (ledger: LedgerData) => Promise<void>): void {
  saveFn = fn;
}

export async function saveLedger(ledger: LedgerData): Promise<void> {
  if (saveFn) await saveFn(ledger);
}

/** React hook - subscribes to store changes. */
export function useStore(): StoreState {
  const [snap, setSnap] = React.useState(getState);
  React.useEffect(() => {
    const unsub = subscribe(setSnap);
    setSnap(getState());
    return unsub;
  }, []);
  return snap;
}
