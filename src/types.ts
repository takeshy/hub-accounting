/** Account types following Beancount convention */
export type AccountType = "Assets" | "Liabilities" | "Income" | "Expenses" | "Equity";

/** Tax categories for Japanese consumption tax */
export type TaxCategory = "taxable_10" | "taxable_8" | "exempt" | "non_taxable" | "tax_free";

/** Valid tax category values */
export const TAX_CATEGORIES: TaxCategory[] = [
  "taxable_10", "taxable_8", "exempt", "non_taxable", "tax_free",
];

/** Ledger template for account presets */
export type LedgerTemplate = "default" | "japan_sole_proprietor";

/** All valid account type prefixes */
export const ACCOUNT_TYPES: AccountType[] = [
  "Assets",
  "Liabilities",
  "Income",
  "Expenses",
  "Equity",
];

/** An account in the chart of accounts */
export interface Account {
  /** Full hierarchical name (e.g., "Assets:Bank:Checking") */
  name: string;
  /** Account type derived from first component */
  type: AccountType;
  /** Date account was opened (ISO date string) */
  openDate: string;
  /** Date account was closed (ISO date string, undefined if still open) */
  closeDate?: string;
  /** Allowed currencies for this account */
  currencies: string[];
}

/** A metadata entry preserving order and allowing duplicate keys */
export type MetadataEntry = [string, string];

/** Transaction metadata with placement before the posting at `postingIndex` */
export interface TransactionMetadataEntry {
  entry: MetadataEntry;
  postingIndex: number;
}

/** A single posting (leg) within a transaction */
export interface Posting {
  /** Account name */
  account: string;
  /** Amount (positive = debit for Assets/Expenses, credit for others) */
  amount: number | null;
  /** Currency code (e.g., "JPY", "USD") */
  currency: string;
  /** Posting-level metadata */
  metadata?: MetadataEntry[];
  /** Tax category for Japanese consumption tax */
  taxCategory?: TaxCategory;
}

/** Transaction flag */
export type TxnFlag = "*" | "!";

/** A complete transaction */
export interface Transaction {
  /** Unique identifier */
  id: string;
  /** Transaction date (ISO date string) */
  date: string;
  /** Flag: * = complete, ! = incomplete/pending */
  flag: TxnFlag;
  /** Payee (optional) */
  payee?: string;
  /** Narration / description */
  narration: string;
  /** Postings (at least 2 for double-entry) */
  postings: Posting[];
  /** Tags (without # prefix) */
  tags: string[];
  /** Links (without ^ prefix) */
  links: string[];
  /** Transaction-level metadata with placement relative to postings */
  metadata?: TransactionMetadataEntry[];
}

/** Balance assertion directive */
export interface BalanceDirective {
  type: "balance";
  date: string;
  account: string;
  amount: number;
  currency: string;
}

/** Pad directive */
export interface PadDirective {
  type: "pad";
  date: string;
  account: string;
  padAccount: string;
}

/** Option directive */
export interface OptionDirective {
  type: "option";
  key: string;
  value: string;
}

/** All directive types */
export type Directive =
  | { type: "open"; date: string; account: string; currencies: string[] }
  | { type: "close"; date: string; account: string }
  | { type: "transaction"; data: Transaction }
  | BalanceDirective
  | PadDirective
  | { type: "commodity"; date: string; currency: string }
  | OptionDirective
  | { type: "comment"; text: string };

/** Complete ledger data */
export interface LedgerData {
  /** All directives in order */
  directives: Directive[];
  /** Options set via option directives */
  options: Record<string, string>;
  /** All accounts (derived from open/close directives) */
  accounts: Account[];
  /** All transactions */
  transactions: Transaction[];
  /** Errors found during parsing or validation */
  errors: LedgerError[];
}

/** Ledger error */
export interface LedgerError {
  line?: number;
  message: string;
  severity: "error" | "warning";
}

/** Account balance at a point in time */
export interface AccountBalance {
  account: string;
  balances: Record<string, number>;
}

/** Report types */
export type ReportType = "journal" | "balance_sheet" | "income_statement" | "trial_balance" | "consumption_tax";

/** Plugin settings */
export interface AccountingSettings {
  /** Default currency */
  defaultCurrency: string;
  /** Date format for display */
  dateFormat: "yyyy-MM-dd" | "dd/MM/yyyy" | "MM/dd/yyyy";
  /** Decimal places */
  decimalPlaces: number;
}

/** Default settings */
export const DEFAULT_SETTINGS: AccountingSettings = {
  defaultCurrency: "JPY",
  dateFormat: "yyyy-MM-dd",
  decimalPlaces: 0,
};
