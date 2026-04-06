/**
 * Module-level shared state store (pub/sub).
 * Bridges sidebar (LedgerPanel) and main view (MainView) across separate React trees.
 */

import * as React from "react";
import { LedgerData, ReportType, AccountingSettings, DEFAULT_SETTINGS } from "./types";

export interface StoreState {
  ledger: LedgerData | null;
  fileName: string;
  activeReport: ReportType;
  settings: AccountingSettings;
  filterDateFrom: string;
  filterDateTo: string;
  filterAccount: string;
  filterQuery: string;
}

type Listener = (state: StoreState) => void;

const initialState: StoreState = {
  ledger: null,
  fileName: "",
  activeReport: "journal",
  settings: DEFAULT_SETTINGS,
  filterDateFrom: "",
  filterDateTo: "",
  filterAccount: "",
  filterQuery: "",
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
