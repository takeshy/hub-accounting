/**
 * Ledger engine: balance calculation, validation, transaction operations.
 */

import {
  LedgerData,
  Transaction,
  Posting,
  Account,
  AccountBalance,
  LedgerError,
  AccountType,
  ACCOUNT_TYPES,
  Directive,
  LedgerTemplate,
} from "../types";

/** Generate a unique id */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Extract account type from full account name */
export function getAccountType(name: string): AccountType | null {
  const prefix = name.split(":")[0];
  return ACCOUNT_TYPES.includes(prefix as AccountType) ? (prefix as AccountType) : null;
}

/** Check if a transaction is balanced (sum of postings ≈ 0) */
export function isBalanced(txn: Transaction, tolerance: number = 0.005): boolean {
  // Group by currency
  const sums = new Map<string, number>();
  let nullCount = 0;

  for (const p of txn.postings) {
    if (p.amount === null) {
      nullCount++;
      continue;
    }
    const cur = p.currency || "???";
    sums.set(cur, (sums.get(cur) || 0) + p.amount);
  }

  // At most one posting can have null amount (auto-balanced)
  if (nullCount > 1) return false;
  if (nullCount === 1) return sums.size === 1; // Auto-balance only supports single-currency txns

  for (const sum of sums.values()) {
    if (Math.abs(sum) > tolerance) return false;
  }
  return true;
}

/** Auto-fill a null posting amount to balance the transaction */
export function autoBalance(txn: Transaction): Transaction {
  const nullIdx = txn.postings.findIndex((p) => p.amount === null);
  if (nullIdx === -1) return txn;

  // Calculate the missing amount per currency
  const sums = new Map<string, number>();
  let currency = "";
  for (let i = 0; i < txn.postings.length; i++) {
    if (i === nullIdx) continue;
    const p = txn.postings[i];
    if (p.amount !== null) {
      const cur = p.currency || "???";
      sums.set(cur, (sums.get(cur) || 0) + p.amount);
      currency = cur;
    }
  }

  // Only works for single-currency transactions
  if (sums.size !== 1) return txn;

  const sum = sums.get(currency) || 0;
  const newPostings = [...txn.postings];
  newPostings[nullIdx] = {
    ...newPostings[nullIdx],
    amount: -sum,
    currency,
  };

  return { ...txn, postings: newPostings };
}

/** Calculate balances for all accounts up to a given date (inclusive) */
export function calculateBalances(
  ledger: LedgerData,
  upToDate?: string
): AccountBalance[] {
  const balances = new Map<string, Map<string, number>>();

  for (const txn of ledger.transactions) {
    if (upToDate && txn.date > upToDate) continue;

    const balanced = autoBalance(txn);
    for (const p of balanced.postings) {
      if (p.amount === null) continue;
      if (!balances.has(p.account)) {
        balances.set(p.account, new Map());
      }
      const accBal = balances.get(p.account)!;
      const cur = p.currency || "???";
      accBal.set(cur, (accBal.get(cur) || 0) + p.amount);
    }
  }

  const result: AccountBalance[] = [];
  for (const [account, balMap] of balances) {
    const balObj: Record<string, number> = {};
    for (const [cur, amt] of balMap) {
      balObj[cur] = amt;
    }
    result.push({ account, balances: balObj });
  }

  return result.sort((a, b) => a.account.localeCompare(b.account));
}

/** Get balances grouped by account type */
export function getBalancesByType(
  balances: AccountBalance[]
): Record<AccountType, AccountBalance[]> {
  const result: Record<AccountType, AccountBalance[]> = {
    Assets: [],
    Liabilities: [],
    Income: [],
    Expenses: [],
    Equity: [],
  };

  for (const ab of balances) {
    const type = getAccountType(ab.account);
    if (type) {
      result[type].push(ab);
    }
  }

  return result;
}

/** Sum balances for a group of accounts (single currency) */
export function sumBalances(
  accountBalances: AccountBalance[],
  currency: string
): number {
  let total = 0;
  for (const ab of accountBalances) {
    total += ab.balances[currency] || 0;
  }
  return total;
}

/** Validate a ledger and return errors */
export function validate(ledger: LedgerData): LedgerError[] {
  const errors: LedgerError[] = [];
  const openAccounts = new Set<string>();
  const closedAccountDates = new Map<string, string>();

  // Check open/close directives
  for (const acc of ledger.accounts) {
    openAccounts.add(acc.name);
    if (acc.closeDate) {
      closedAccountDates.set(acc.name, acc.closeDate);
    }
  }

  // Check transactions
  for (const txn of ledger.transactions) {
    // Check balance
    if (!isBalanced(txn)) {
      errors.push({
        message: `Unbalanced transaction on ${txn.date}: "${txn.narration}"`,
        severity: "error",
      });
    }

    // Check accounts exist
    for (const p of txn.postings) {
      if (!openAccounts.has(p.account)) {
        errors.push({
          message: `Account "${p.account}" used in transaction on ${txn.date} is not opened`,
          severity: "warning",
        });
      }
      const closeDate = closedAccountDates.get(p.account);
      if (closeDate && txn.date > closeDate) {
        errors.push({
          message: `Account "${p.account}" was closed on ${closeDate} but used on ${txn.date}`,
          severity: "error",
        });
      }
    }
  }

  // Check balance assertions
  for (const dir of ledger.directives) {
    if (dir.type === "balance") {
      const balances = calculateBalances(ledger, dir.date);
      const accBal = balances.find((b) => b.account === dir.account);
      const actual = accBal?.balances[dir.currency] || 0;
      if (Math.abs(actual - dir.amount) > 0.005) {
        errors.push({
          message: `Balance assertion failed for ${dir.account} on ${dir.date}: expected ${dir.amount} ${dir.currency}, got ${actual} ${dir.currency}`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}

/** Merge parse-time errors with current validation results */
export function refreshErrors(ledger: LedgerData): LedgerData {
  const parseErrors = ledger.errors.filter((error) => error.line !== undefined);
  const validationErrors = validate({ ...ledger, errors: [] });
  return {
    ...ledger,
    errors: [...parseErrors, ...validationErrors],
  };
}

/** Add a transaction to a ledger (returns a new LedgerData) */
export function addTransaction(
  ledger: LedgerData,
  txn: Omit<Transaction, "id">
): LedgerData {
  const newTxn: Transaction = { ...txn, id: uid() };
  const newTransactions = [...ledger.transactions, newTxn].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const newDirectives: Directive[] = [...ledger.directives, { type: "transaction", data: newTxn }];

  return refreshErrors({
    ...ledger,
    transactions: newTransactions,
    directives: newDirectives,
  });
}

/** Remove a transaction from a ledger */
export function removeTransaction(ledger: LedgerData, txnId: string): LedgerData {
  return refreshErrors({
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.id !== txnId),
    directives: ledger.directives.filter(
      (d) => !(d.type === "transaction" && d.data.id === txnId)
    ),
  });
}

/** Update a transaction in a ledger */
export function updateTransaction(
  ledger: LedgerData,
  txnId: string,
  updates: Partial<Omit<Transaction, "id">>
): LedgerData {
  const newTransactions = ledger.transactions.map((t) =>
    t.id === txnId ? { ...t, ...updates } : t
  );
  const newDirectives = ledger.directives.map((d) =>
    d.type === "transaction" && d.data.id === txnId
      ? { ...d, data: { ...d.data, ...updates } }
      : d
  );

  return refreshErrors({
    ...ledger,
    transactions: newTransactions.sort((a, b) => a.date.localeCompare(b.date)),
    directives: newDirectives,
  });
}

/** Add an account to a ledger */
export function addAccount(
  ledger: LedgerData,
  account: Account
): LedgerData {
  if (ledger.accounts.find((a) => a.name === account.name)) {
    return ledger; // Already exists
  }

  return refreshErrors({
    ...ledger,
    accounts: [...ledger.accounts, account].sort((a, b) => a.name.localeCompare(b.name)),
    directives: [
      ...ledger.directives,
      { type: "open", date: account.openDate, account: account.name, currencies: account.currencies },
    ],
  });
}

/** Japan sole proprietor account definitions (青色申告決算書準拠) */
function japanSoleProprietorAccounts(today: string, cur: string): Account[] {
  const a = (name: string, type: AccountType): Account => ({
    name, type, openDate: today, currencies: [cur],
  });
  return [
    // 資産
    a("Assets:Cash", "Assets"),
    a("Assets:OrdinaryDeposit", "Assets"),
    a("Assets:AccountsReceivable", "Assets"),
    // 負債
    a("Liabilities:AccountsPayable", "Liabilities"),
    a("Liabilities:AccruedLiabilities", "Liabilities"),
    a("Liabilities:WithholdingTax", "Liabilities"),
    a("Liabilities:Borrowings", "Liabilities"),
    // 収益
    a("Income:Sales", "Income"),
    a("Income:OtherIncome", "Income"),
    // 費用
    a("Expenses:Purchases", "Expenses"),
    a("Expenses:Salary", "Expenses"),
    a("Expenses:Outsourcing", "Expenses"),
    a("Expenses:Rent", "Expenses"),
    a("Expenses:Utilities", "Expenses"),
    a("Expenses:Travel", "Expenses"),
    a("Expenses:Communication", "Expenses"),
    a("Expenses:Advertising", "Expenses"),
    a("Expenses:Entertainment", "Expenses"),
    a("Expenses:Insurance", "Expenses"),
    a("Expenses:Repairs", "Expenses"),
    a("Expenses:Supplies", "Expenses"),
    a("Expenses:Depreciation", "Expenses"),
    a("Expenses:Welfare", "Expenses"),
    a("Expenses:PackagingShipping", "Expenses"),
    a("Expenses:TaxesDues", "Expenses"),
    a("Expenses:Fees", "Expenses"),
    a("Expenses:Interest", "Expenses"),
    a("Expenses:Miscellaneous", "Expenses"),
    // 純資産
    a("Equity:OpeningCapital", "Equity"),
    a("Equity:OwnerDraw", "Equity"),
    a("Equity:OwnerContribution", "Equity"),
  ];
}

/** Create an empty ledger */
export function createEmptyLedger(defaultCurrency: string, template: LedgerTemplate = "default"): LedgerData {
  const today = new Date().toISOString().slice(0, 10);

  const defaultAccounts: Account[] = template === "japan_sole_proprietor"
    ? japanSoleProprietorAccounts(today, defaultCurrency)
    : [
    { name: "Assets:Bank", type: "Assets", openDate: today, currencies: [defaultCurrency] },
    { name: "Assets:Cash", type: "Assets", openDate: today, currencies: [defaultCurrency] },
    { name: "Liabilities:CreditCard", type: "Liabilities", openDate: today, currencies: [defaultCurrency] },
    { name: "Income:Salary", type: "Income", openDate: today, currencies: [defaultCurrency] },
    { name: "Expenses:Food", type: "Expenses", openDate: today, currencies: [defaultCurrency] },
    { name: "Expenses:Transport", type: "Expenses", openDate: today, currencies: [defaultCurrency] },
    { name: "Expenses:Housing", type: "Expenses", openDate: today, currencies: [defaultCurrency] },
    { name: "Expenses:Utilities", type: "Expenses", openDate: today, currencies: [defaultCurrency] },
    { name: "Expenses:Other", type: "Expenses", openDate: today, currencies: [defaultCurrency] },
    { name: "Equity:Opening-Balances", type: "Equity", openDate: today, currencies: [defaultCurrency] },
  ];

  const directives: Directive[] = [
    { type: "option", key: "operating_currency", value: defaultCurrency },
    ...defaultAccounts.map(
      (a): Directive => ({
        type: "open",
        date: a.openDate,
        account: a.name,
        currencies: a.currencies,
      })
    ),
  ];

  return refreshErrors({
    directives,
    options: { operating_currency: defaultCurrency },
    accounts: defaultAccounts,
    transactions: [],
    errors: [],
  });
}
